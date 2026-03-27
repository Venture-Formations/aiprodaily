import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { SparkLoopService, createSparkLoopServiceForPublication } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'
import axios from 'axios'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'check-mailerlite-campaigns': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')

      // Get mailerlite_issue_ids from database
      const { data: storedMetrics, error: dbError } = await supabaseAdmin
        .from('email_metrics')
        .select('issue_id, mailerlite_issue_id')
        .not('mailerlite_issue_id', 'is', null)
        .order('imported_at', { ascending: false })
        .limit(limit)

      if (dbError) {
        return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 })
      }

      logger.info({ count: storedMetrics?.length || 0 }, '[Debug] Found stored mailerlite_issue_ids')

      // Query MailerLite API to list campaigns
      const mailerliteClient = axios.create({
        baseURL: MAILERLITE_API_BASE,
        headers: {
          'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      logger.info('[Debug] Querying MailerLite API for campaigns...')

      let mailerliteCampaigns: any[] = []
      let page = 1
      const perPage = 100

      try {
        while (true) {
          const response = await mailerliteClient.get('/campaigns', {
            params: {
              page,
              limit: perPage,
              sort: 'created_at',
              sort_dir: 'DESC'
            }
          })

          if (response.data?.data && Array.isArray(response.data.data)) {
            mailerliteCampaigns = mailerliteCampaigns.concat(response.data.data)

            // Check if there are more pages
            if (response.data.data.length < perPage) {
              break
            }
            page++

            // Safety limit
            if (page > 10) break
          } else {
            break
          }
        }
      } catch (error: any) {
        logger.error({ err: error.response?.data || error.message }, '[Debug] Error fetching campaigns from MailerLite')
        return NextResponse.json({
          error: 'Failed to fetch campaigns from MailerLite',
          mailerliteError: error.response?.data || error.message,
          storedIds: storedMetrics?.map(m => ({ issue_id: m.issue_id, mailerlite_id: m.mailerlite_issue_id }))
        }, { status: 500 })
      }

      logger.info({ count: mailerliteCampaigns.length }, '[Debug] Found campaigns in MailerLite')

      // Extract IDs from MailerLite campaigns
      const mailerliteIds = new Set(mailerliteCampaigns.map(c => String(c.id)))

      // Compare stored IDs with MailerLite IDs
      const comparison = (storedMetrics || []).map(stored => {
        const storedId = String(stored.mailerlite_issue_id)
        const existsInMailerLite = mailerliteIds.has(storedId)

        // Find matching campaign in MailerLite
        const mailerliteCampaign = mailerliteCampaigns.find(c => String(c.id) === storedId)

        return {
          issue_id: stored.issue_id,
          stored_mailerlite_id: stored.mailerlite_issue_id,
          stored_id_type: typeof stored.mailerlite_issue_id,
          exists_in_mailerlite: existsInMailerLite,
          mailerlite_campaign: mailerliteCampaign ? {
            id: mailerliteCampaign.id,
            id_type: typeof mailerliteCampaign.id,
            name: mailerliteCampaign.name,
            status: mailerliteCampaign.status,
            created_at: mailerliteCampaign.created_at
          } : null
        }
      })

      // Get summary
      const existsCount = comparison.filter(c => c.exists_in_mailerlite).length
      const notExistsCount = comparison.filter(c => !c.exists_in_mailerlite).length

      // Sample of MailerLite campaign IDs for comparison
      const sampleMailerliteIds = mailerliteCampaigns.slice(0, 5).map(c => ({
        id: c.id,
        id_type: typeof c.id,
        name: c.name,
        status: c.status,
        created_at: c.created_at
      }))

      return NextResponse.json({
        summary: {
          stored_ids_count: storedMetrics?.length || 0,
          mailerlite_campaigns_count: mailerliteCampaigns.length,
          matching_ids: existsCount,
          missing_ids: notExistsCount
        },
        sample_mailerlite_campaigns: sampleMailerliteIds,
        comparison: comparison.slice(0, 20), // Limit to first 20 for readability
        stored_id_samples: storedMetrics?.slice(0, 5).map(m => ({
          issue_id: m.issue_id,
          mailerlite_issue_id: m.mailerlite_issue_id,
          id_type: typeof m.mailerlite_issue_id
        }))
      })
    }
  },

  'check-subject-prompt': {
    GET: async ({ logger }) => {
      // Get the active publication
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
      }

      // Fetch subject line prompt
      const { data: prompt } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', newsletter.id)
        .eq('key', 'ai_prompt_subject_line')
        .single()

      if (!prompt) {
        return NextResponse.json({ error: 'Subject line prompt not found' }, { status: 404 })
      }

      // Parse and analyze
      let parsed: any = null
      let parseError: string | null = null
      let issues: string[] = []

      try {
        parsed = JSON.parse(prompt.value)
      } catch (e) {
        parseError = (e as Error).message
      }

      if (parsed) {
        // Check for issues
        if (parsed.model && parsed.model.includes('claude')) {
          issues.push(`Model is Claude (${parsed.model}) but may be called with OpenAI provider`)
        }
        if (parsed.model && parsed.model.includes('gpt')) {
          issues.push(`Model is OpenAI (${parsed.model})`)
        }
        if (!parsed.model) {
          issues.push('No model specified in prompt')
        }
      }

      return NextResponse.json({
        key: prompt.key,
        value_length: prompt.value?.length,
        parse_error: parseError,
        parsed_model: parsed?.model,
        parsed_keys: parsed ? Object.keys(parsed) : [],
        issues,
        first_500_chars: prompt.value?.substring(0, 500)
      })
    }
  },

  'fix-ai-prompt-values': {
    GET: async ({ logger }) => {
      // Get the active publication
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
      }

      // Fetch AI prompts
      const { data: prompts, error } = await supabaseAdmin
        .from('publication_settings')
        .select('id, key, value')
        .eq('publication_id', newsletter.id)
        .like('key', 'ai_prompt_%')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []
      const diagnostics: any[] = []

      for (const prompt of prompts || []) {
        const value = prompt.value

        const diag: any = {
          key: prompt.key,
          first_char: value?.charAt(0),
          last_char: value?.charAt(value.length - 1),
          length: value?.length
        }

        // Check if value is a JSON string (starts with " when parsed as text)
        // This would mean it's double-stringified
        if (typeof value === 'string' && value.length > 0) {
          try {
            // Try to parse it as JSON
            const parsed = JSON.parse(value)

            diag.parsed_type = typeof parsed

            // If it parsed to a string, that's the double-stringify issue
            if (typeof parsed === 'string') {
              diag.issue = 'double_stringified'
              diag.inner_first_char = parsed.charAt(0)

              // The parsed string should be valid JSON (the actual prompt)
              try {
                JSON.parse(parsed)
                diag.inner_is_valid_json = true
                // This is the fix - use the inner string
                updates.push({
                  id: prompt.id,
                  key: prompt.key,
                  oldValue: value.substring(0, 100) + '...',
                  newValue: parsed
                })
              } catch (e) {
                diag.inner_is_valid_json = false
                diag.inner_error = (e as Error).message
              }
            } else if (typeof parsed === 'object') {
              diag.issue = 'none - already valid JSON object'
            }
          } catch (e) {
            diag.parse_error = (e as Error).message

            // Check if it contains literal \n sequences (not actual newlines)
            // This causes "Expected property name" errors
            if (value.includes('\\n') || value.includes('\\t') || value.includes('\\"')) {
              diag.issue = 'contains_escaped_chars'

              // Try to fix by replacing escaped sequences with actual chars
              const unescaped = value
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')

              try {
                JSON.parse(unescaped)
                diag.fixed_is_valid = true
                updates.push({
                  id: prompt.id,
                  key: prompt.key,
                  oldValue: value.substring(0, 100) + '...',
                  newValue: unescaped
                })
              } catch (e2) {
                diag.fixed_is_valid = false
                diag.fix_error = (e2 as Error).message
              }
            } else {
              diag.issue = 'invalid_json'
            }
          }
        }

        diagnostics.push(diag)
      }

      // Apply fixes if any found
      if (updates.length > 0) {
        let fixedCount = 0
        for (const update of updates) {
          const { error: updateError } = await supabaseAdmin
            .from('publication_settings')
            .update({ value: update.newValue, updated_at: new Date().toISOString() })
            .eq('id', update.id)

          if (!updateError) {
            fixedCount++
          }
        }

        return NextResponse.json({
          message: `Fixed ${fixedCount} AI prompts`,
          totalPrompts: prompts?.length || 0,
          fixedCount,
          diagnostics,
          updates: updates.map(u => ({ key: u.key }))
        })
      }

      return NextResponse.json({
        message: 'No AI prompts need fixing',
        totalPrompts: prompts?.length || 0,
        diagnostics
      })
    }
  },

  'fix-quoted-settings': {
    GET: async ({ logger }) => {
      return handleFixQuotedSettings(logger)
    },
    POST: async ({ logger }) => {
      return handleFixQuotedSettings(logger)
    }
  },

  'restore-ai-prompts': {
    GET: async ({ logger }) => {
      // Get the active publication
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
      }

      // Fetch from app_settings (original source)
      const { data: appPrompts, error: appError } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'ai_prompt_%')

      if (appError) {
        return NextResponse.json({ error: appError.message }, { status: 500 })
      }

      logger.info({ count: appPrompts?.length || 0 }, 'Found prompts in app_settings')

      // Compare with publication_settings
      const { data: pubPrompts } = await supabaseAdmin
        .from('publication_settings')
        .select('id, key, value')
        .eq('publication_id', newsletter.id)
        .like('key', 'ai_prompt_%')

      const pubPromptsMap = new Map(pubPrompts?.map(p => [p.key, p]) || [])

      const updates: any[] = []
      const diagnostics: any[] = []

      for (const appPrompt of appPrompts || []) {
        const pubPrompt = pubPromptsMap.get(appPrompt.key)

        // Handle both string and object values from app_settings
        const appValue = typeof appPrompt.value === 'object'
          ? JSON.stringify(appPrompt.value)
          : appPrompt.value
        const pubValue = pubPrompt?.value

        const diag: any = {
          key: appPrompt.key,
          app_value_type: typeof appPrompt.value,
          app_value_length: appValue?.length || 0,
          pub_value_length: pubValue?.length || 0,
          values_match: appValue === pubValue
        }

        // Check if app_settings value is valid JSON
        if (typeof appPrompt.value === 'object') {
          diag.app_is_valid_json = true
        } else {
          try {
            JSON.parse(appValue)
            diag.app_is_valid_json = true
          } catch (e) {
            diag.app_is_valid_json = false
            // Plain text prompts are OK
            if (appValue?.startsWith('Y') || appValue?.startsWith('C')) {
              diag.app_is_plain_text = true
            }
          }
        }

        // If publication_settings has corrupted value but app_settings is good, restore it
        if (pubPrompt && !diag.values_match) {
          updates.push({
            id: pubPrompt.id,
            key: appPrompt.key,
            newValue: appValue,
            oldLength: pubValue?.length || 0,
            newLength: appValue?.length || 0
          })
        }

        diagnostics.push(diag)
      }

      if (updates.length === 0) {
        return NextResponse.json({
          message: 'All prompts match app_settings - no restoration needed',
          diagnostics
        })
      }

      // Apply restorations
      let restoredCount = 0
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from('publication_settings')
          .update({
            value: update.newValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)

        if (!updateError) {
          restoredCount++
        }
      }

      return NextResponse.json({
        message: `Restored ${restoredCount} AI prompts from app_settings`,
        totalPrompts: appPrompts?.length || 0,
        restoredCount,
        updates: updates.map(u => ({
          key: u.key,
          oldLength: u.oldLength,
          newLength: u.newLength
        })),
        diagnostics
      })
    }
  },

  'sparkloop-test': {
    POST: async ({ request, logger }) => {
      const { email, refCodes } = await request.json()

      if (!email || !refCodes || !Array.isArray(refCodes)) {
        return NextResponse.json(
          { error: 'email and refCodes[] required' },
          { status: 400 }
        )
      }

      const service = await createSparkLoopServiceForPublication(PUBLICATION_ID)
      if (!service) {
        return NextResponse.json({ error: 'SparkLoop not configured' }, { status: 500 })
      }

      logger.info({ email, refCodes }, '[SparkLoop Test] Testing subscription...')

      const result = await service.subscribeToNewsletters({
        subscriber_email: email,
        country_code: 'US',
        recommendations: refCodes.join(','),
        utm_source: 'debug_test',
      })

      return NextResponse.json({
        success: true,
        message: 'Subscription sent to SparkLoop',
        sparkloopResponse: result.response,
        testData: { email, refCodes },
      })
    },
    GET: async ({ logger }) => {
      const service = await createSparkLoopServiceForPublication(PUBLICATION_ID)
      if (!service) {
        return NextResponse.json({ error: 'SparkLoop not configured' }, { status: 500 })
      }
      const stored = await service.getStoredRecommendations(PUBLICATION_ID)

      const active = stored.filter(r => r.status === 'active' && !(r as any).excluded)

      return NextResponse.json({
        message: 'Use these ref_codes to test subscription',
        activeCount: active.length,
        refCodes: active.slice(0, 5).map(r => ({
          ref_code: r.ref_code,
          name: r.publication_name,
          cpa: r.cpa,
        })),
        exampleRequest: {
          method: 'POST',
          body: {
            email: 'test@example.com',
            refCodes: active.slice(0, 2).map(r => r.ref_code),
          },
        },
      })
    }
  },
}

// --- Helper functions ---

async function handleFixQuotedSettings(logger: any) {
  logger.info('Fetching all publication_settings...')

  const { data: settings, error } = await supabaseAdmin
    .from('publication_settings')
    .select('id, key, value')

  if (error) {
    logger.error({ err: error }, 'Error fetching settings')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info({ count: settings?.length || 0 }, 'Found settings')

  const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []

  for (const setting of settings || []) {
    if (setting.value &&
        setting.value.startsWith('"') &&
        setting.value.endsWith('"') &&
        setting.value.length > 2) {
      let newValue: string

      // Try to parse as JSON first (handles escaped JSON strings)
      try {
        const parsed = JSON.parse(setting.value)
        // If the parsed value is a string, use it directly
        // If it's an object, stringify it back without extra quotes
        if (typeof parsed === 'string') {
          newValue = parsed
        } else {
          // This shouldn't happen, but handle it anyway
          newValue = JSON.stringify(parsed)
        }
      } catch (e) {
        // If JSON.parse fails, fall back to simple quote stripping
        newValue = setting.value.slice(1, -1)
      }

      // Only update if the value actually changed
      if (newValue !== setting.value) {
        updates.push({
          id: setting.id,
          key: setting.key,
          oldValue: setting.value,
          newValue
        })
      }
    }
  }

  logger.info({ count: updates.length }, 'Found settings with extra quotes')

  if (updates.length === 0) {
    return NextResponse.json({
      message: 'No settings need fixing!',
      totalSettings: settings?.length || 0,
      fixedCount: 0
    })
  }

  let fixedCount = 0
  for (const update of updates) {
    logger.info({ key: update.key }, 'Fixing setting')
    const { error: updateError } = await supabaseAdmin
      .from('publication_settings')
      .update({ value: update.newValue, updated_at: new Date().toISOString() })
      .eq('id', update.id)

    if (updateError) {
      logger.error({ key: update.key, err: updateError }, 'Error updating setting')
    } else {
      fixedCount++
    }
  }

  return NextResponse.json({
    message: `Fixed ${fixedCount} settings`,
    totalSettings: settings?.length || 0,
    fixedCount,
    updates: updates.map(u => ({ key: u.key, old: u.oldValue, new: u.newValue }))
  })
}
