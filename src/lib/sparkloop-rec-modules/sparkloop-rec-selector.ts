/**
 * SparkLoop Recommendation Module Selector
 *
 * Selects recommendations for newsletter modules using score-based,
 * random, sequential, or manual selection modes.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings } from '@/lib/publication-settings'
import type { SparkLoopRecModule, SparkLoopRecSelectionMode } from '@/types/database'

const FALLBACK_DEFAULT_CR = 22  // 22%
const FALLBACK_DEFAULT_RCR = 25 // 25%

interface EligibleRec {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  cpa: number | null
  status: string
  excluded: boolean | null
  sparkloop_rcr: number | null
  our_cr: number | null
  our_rcr: number | null
  override_cr: number | null
  override_rcr: number | null
  impressions: number
  calculated_score: number
}

interface SelectionResult {
  moduleId: string
  moduleName: string
  refCodes: string[]
  selectionMode: SparkLoopRecSelectionMode
}

export class SparkLoopRecModuleSelector {
  /**
   * Get eligible recommendations for module inclusion
   */
  static async getEligibleRecommendations(publicationId: string): Promise<EligibleRec[]> {
    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('id, ref_code, publication_name, publication_logo, description, cpa, status, excluded, sparkloop_rcr, our_cr, our_rcr, override_cr, override_rcr, impressions')
      .eq('publication_id', publicationId)
      .eq('eligible_for_module', true)
      .eq('status', 'active')
      .or('excluded.eq.false,excluded.is.null')

    if (error) {
      console.error('[SparkLoop Rec Selector] Failed to fetch eligible recs:', error.message)
      return []
    }

    // Load defaults for scoring
    const defaults = await getPublicationSettings(publicationId, [
      'sparkloop_default_cr',
      'sparkloop_default_rcr',
    ])
    const defaultCr = defaults.sparkloop_default_cr ? parseFloat(defaults.sparkloop_default_cr) : FALLBACK_DEFAULT_CR
    const defaultRcr = defaults.sparkloop_default_rcr ? parseFloat(defaults.sparkloop_default_rcr) : FALLBACK_DEFAULT_RCR

    // Score each rec using the same logic as admin API
    return (data || []).map(rec => {
      const hasOverrideCr = rec.override_cr !== null && rec.override_cr !== undefined
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const hasEnoughData = (rec.impressions || 0) >= 50
      const hasOurCr = hasEnoughData && rec.our_cr !== null && Number(rec.our_cr) > 0
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0

      let effectiveCr: number
      if (hasOurCr) {
        effectiveCr = Number(rec.our_cr)
      } else if (hasOverrideCr) {
        effectiveCr = Number(rec.override_cr)
      } else {
        effectiveCr = defaultCr
      }

      let effectiveRcr: number
      if (hasSLRcr) {
        effectiveRcr = slRcr!
      } else if (hasOverrideRcr) {
        effectiveRcr = Number(rec.override_rcr)
      } else {
        effectiveRcr = defaultRcr
      }

      const cr = effectiveCr / 100
      const rcr = effectiveRcr / 100
      const cpa = (rec.cpa || 0) / 100
      const score = cr * cpa * rcr

      return {
        ...rec,
        excluded: rec.excluded ?? false,
        impressions: rec.impressions ?? 0,
        calculated_score: score,
      }
    })
  }

  /**
   * Select recommendations for a single module based on its selection mode
   */
  static async selectRecsForModule(
    module: SparkLoopRecModule,
    eligible: EligibleRec[]
  ): Promise<string[]> {
    const count = module.recs_count || 3

    if (eligible.length === 0) return []
    if (module.selection_mode === 'manual') return []

    if (module.selection_mode === 'score_based') {
      // Sort by score descending, take top N
      const sorted = [...eligible].sort((a, b) => b.calculated_score - a.calculated_score)
      return sorted.slice(0, count).map(r => r.ref_code)
    }

    if (module.selection_mode === 'random') {
      // Shuffle and take N
      const shuffled = [...eligible].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count).map(r => r.ref_code)
    }

    if (module.selection_mode === 'sequential') {
      // Order by ref_code (stable), use next_position to cycle
      const sorted = [...eligible].sort((a, b) => a.ref_code.localeCompare(b.ref_code))
      const start = ((module.next_position || 1) - 1) % sorted.length
      const selected: string[] = []
      for (let i = 0; i < count && i < sorted.length; i++) {
        selected.push(sorted[(start + i) % sorted.length].ref_code)
      }
      return selected
    }

    return []
  }

  /**
   * Select recommendations for all active modules for a given issue
   */
  static async selectRecsForIssue(
    issueId: string,
    publicationId: string
  ): Promise<SelectionResult[]> {
    // Get active modules
    const { data: modules, error: modErr } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, publication_id, name, display_order, is_active, selection_mode, block_order, config, recs_count, next_position, created_at, updated_at')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (modErr || !modules || modules.length === 0) {
      console.log('[SparkLoop Rec Selector] No active modules found')
      return []
    }

    // Get eligible recs once for all modules
    const eligible = await this.getEligibleRecommendations(publicationId)
    if (eligible.length === 0) {
      console.log('[SparkLoop Rec Selector] No eligible recommendations found')
      return []
    }

    const results: SelectionResult[] = []

    for (const mod of modules) {
      const refCodes = await this.selectRecsForModule(mod as SparkLoopRecModule, eligible)

      // Upsert into issue_sparkloop_rec_modules
      const { error: upsertErr } = await supabaseAdmin
        .from('issue_sparkloop_rec_modules')
        .upsert({
          issue_id: issueId,
          sparkloop_rec_module_id: mod.id,
          ref_codes: refCodes,
          selection_mode: mod.selection_mode,
          selected_at: new Date().toISOString(),
        }, {
          onConflict: 'issue_id,sparkloop_rec_module_id',
        })

      if (upsertErr) {
        console.error(`[SparkLoop Rec Selector] Upsert failed for module ${mod.name}:`, upsertErr.message)
      }

      results.push({
        moduleId: mod.id,
        moduleName: mod.name,
        refCodes,
        selectionMode: mod.selection_mode as SparkLoopRecSelectionMode,
      })
    }

    return results
  }

  /**
   * Manually select specific recommendations for a module on an issue
   */
  static async manuallySelectRecs(
    issueId: string,
    moduleId: string,
    refCodes: string[]
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_sparkloop_rec_modules')
      .upsert({
        issue_id: issueId,
        sparkloop_rec_module_id: moduleId,
        ref_codes: refCodes,
        selection_mode: 'manual',
        selected_at: new Date().toISOString(),
      }, {
        onConflict: 'issue_id,sparkloop_rec_module_id',
      })

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  }

  /**
   * Get issue selections with full recommendation data
   */
  static async getIssueSelections(issueId: string): Promise<{
    selections: Array<{
      id: string
      sparkloop_rec_module_id: string
      ref_codes: string[]
      selection_mode: string | null
      selected_at: string
      used_at: string | null
      sparkloop_rec_module: SparkLoopRecModule | null
      recommendations: EligibleRec[]
    }>
  }> {
    const { data: selections, error } = await supabaseAdmin
      .from('issue_sparkloop_rec_modules')
      .select(`
        id, sparkloop_rec_module_id, ref_codes, selection_mode, selected_at, used_at,
        sparkloop_rec_module:sparkloop_rec_modules(*)
      `)
      .eq('issue_id', issueId)

    if (error || !selections) {
      return { selections: [] }
    }

    // For each selection, fetch the full recommendation data for its ref_codes
    const results = await Promise.all(selections.map(async (sel) => {
      const refCodes = (sel.ref_codes || []) as string[]
      let recommendations: EligibleRec[] = []

      if (refCodes.length > 0) {
        const { data: recs } = await supabaseAdmin
          .from('sparkloop_recommendations')
          .select('id, ref_code, publication_name, publication_logo, description, cpa, status, excluded, sparkloop_rcr, our_cr, our_rcr, override_cr, override_rcr, impressions')
          .in('ref_code', refCodes)

        if (recs) {
          // Preserve selection order
          const recMap = new Map(recs.map(r => [r.ref_code, r]))
          recommendations = refCodes
            .map(rc => recMap.get(rc))
            .filter((r): r is NonNullable<typeof r> => !!r)
            .map(r => ({ ...r, excluded: r.excluded ?? false, impressions: r.impressions ?? 0, calculated_score: 0 }))
        }
      }

      return {
        ...sel,
        sparkloop_rec_module: sel.sparkloop_rec_module as unknown as SparkLoopRecModule | null,
        recommendations,
      }
    }))

    return { selections: results }
  }

  /**
   * Record usage (sent) for all sparkloop rec module selections on an issue
   */
  static async recordUsage(issueId: string): Promise<{ recorded: number }> {
    const { data, error } = await supabaseAdmin
      .from('issue_sparkloop_rec_modules')
      .update({ used_at: new Date().toISOString() })
      .eq('issue_id', issueId)
      .is('used_at', null)
      .select('id')

    if (error) {
      console.error('[SparkLoop Rec Selector] Failed to record usage:', error.message)
      return { recorded: 0 }
    }

    // Advance sequential position for sequential modules
    const { data: selections } = await supabaseAdmin
      .from('issue_sparkloop_rec_modules')
      .select('sparkloop_rec_module_id, ref_codes, selection_mode')
      .eq('issue_id', issueId)

    if (selections) {
      for (const sel of selections) {
        if (sel.selection_mode === 'sequential' && (sel.ref_codes as string[])?.length > 0) {
          const { data: mod } = await supabaseAdmin
            .from('sparkloop_rec_modules')
            .select('next_position')
            .eq('id', sel.sparkloop_rec_module_id)
            .single()

          if (mod) {
            const advance = (sel.ref_codes as string[]).length
            await supabaseAdmin
              .from('sparkloop_rec_modules')
              .update({ next_position: (mod.next_position || 1) + advance })
              .eq('id', sel.sparkloop_rec_module_id)
          }
        }
      }
    }

    return { recorded: data?.length || 0 }
  }
}
