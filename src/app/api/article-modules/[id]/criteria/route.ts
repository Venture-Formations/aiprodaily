import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/article-modules/[id]/criteria - List criteria for a module
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params

    const { data: criteria, error } = await supabaseAdmin
      .from('article_module_criteria')
      .select('*')
      .eq('article_module_id', moduleId)
      .order('criteria_number', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      criteria: criteria || []
    })

  } catch (error: any) {
    console.error('[ArticleModuleCriteria] Failed to fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch criteria', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/article-modules/[id]/criteria - Add new criterion
 * Max 5 criteria per module
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Check current criteria count
    const { data: existing, error: countError } = await supabaseAdmin
      .from('article_module_criteria')
      .select('criteria_number')
      .eq('article_module_id', moduleId)
      .order('criteria_number', { ascending: false })

    if (countError) throw countError

    if (existing && existing.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum of 5 criteria per module' },
        { status: 400 }
      )
    }

    const nextNumber = (existing?.[0]?.criteria_number ?? 0) + 1

    // Create the criterion
    const { data: criterion, error } = await supabaseAdmin
      .from('article_module_criteria')
      .insert({
        article_module_id: moduleId,
        criteria_number: nextNumber,
        name: body.name,
        weight: body.weight ?? 0.2,
        ai_prompt: body.ai_prompt ?? null,
        is_active: body.is_active ?? true,
        enforce_minimum: body.enforce_minimum ?? false,
        minimum_score: body.minimum_score ?? null
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[ArticleModuleCriteria] Created criterion: ${criterion.name} (#${criterion.criteria_number})`)

    return NextResponse.json({
      success: true,
      criterion
    }, { status: 201 })

  } catch (error: any) {
    console.error('[ArticleModuleCriteria] Failed to create:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create criterion', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/article-modules/[id]/criteria - Update criteria (single or bulk)
 * Body: { criteria_id, ...updates } OR { criteria: [{ id, ...updates }] }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
    const body = await request.json()

    // Bulk update mode
    if (body.criteria && Array.isArray(body.criteria)) {
      // Validate total weight sums to ~1.0 for active criteria
      const activeCriteria = body.criteria.filter((c: any) => c.is_active !== false)
      const totalWeight = activeCriteria.reduce((sum: number, c: any) => sum + (c.weight || 0), 0)

      if (Math.abs(totalWeight - 1.0) > 0.01 && activeCriteria.length > 0) {
        return NextResponse.json(
          { error: `Weights must sum to 100%. Current sum: ${(totalWeight * 100).toFixed(1)}%` },
          { status: 400 }
        )
      }

      // Update each criterion
      for (const item of body.criteria) {
        if (!item.id) continue

        const updates: Record<string, any> = {}
        if (item.name !== undefined) updates.name = item.name
        if (item.weight !== undefined) updates.weight = item.weight
        if (item.ai_prompt !== undefined) updates.ai_prompt = item.ai_prompt
        if (item.is_active !== undefined) updates.is_active = item.is_active
        if (item.enforce_minimum !== undefined) updates.enforce_minimum = item.enforce_minimum
        if (item.minimum_score !== undefined) updates.minimum_score = item.minimum_score

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString()
          await supabaseAdmin
            .from('article_module_criteria')
            .update(updates)
            .eq('id', item.id)
            .eq('article_module_id', moduleId)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Updated ${body.criteria.length} criteria`
      })
    }

    // Single update mode
    if (!body.criteria_id) {
      return NextResponse.json(
        { error: 'criteria_id is required for single update' },
        { status: 400 }
      )
    }

    // Validate minimum_score if provided
    if (body.minimum_score !== undefined && body.minimum_score !== null) {
      if (body.minimum_score < 0 || body.minimum_score > 10) {
        return NextResponse.json(
          { error: 'minimum_score must be between 0 and 10' },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.weight !== undefined) updates.weight = body.weight
    if (body.ai_prompt !== undefined) updates.ai_prompt = body.ai_prompt
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.enforce_minimum !== undefined) updates.enforce_minimum = body.enforce_minimum
    if (body.minimum_score !== undefined) updates.minimum_score = body.minimum_score

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data: criterion, error } = await supabaseAdmin
      .from('article_module_criteria')
      .update(updates)
      .eq('id', body.criteria_id)
      .eq('article_module_id', moduleId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Criterion not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      criterion
    })

  } catch (error: any) {
    console.error('[ArticleModuleCriteria] Failed to update:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update criteria', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/article-modules/[id]/criteria - Delete a criterion
 * Query param: criteria_id
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: moduleId } = await context.params
    const criteriaId = request.nextUrl.searchParams.get('criteria_id')

    if (!criteriaId) {
      return NextResponse.json(
        { error: 'criteria_id query parameter is required' },
        { status: 400 }
      )
    }

    // Check minimum criteria (at least 1 must remain)
    const { data: remaining } = await supabaseAdmin
      .from('article_module_criteria')
      .select('id')
      .eq('article_module_id', moduleId)
      .neq('id', criteriaId)

    if (!remaining || remaining.length === 0) {
      return NextResponse.json(
        { error: 'Cannot delete last criterion. At least one criterion is required.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('article_module_criteria')
      .delete()
      .eq('id', criteriaId)
      .eq('article_module_id', moduleId)

    if (error) throw error

    console.log(`[ArticleModuleCriteria] Deleted criterion: ${criteriaId}`)

    return NextResponse.json({
      success: true,
      message: 'Criterion deleted'
    })

  } catch (error: any) {
    console.error('[ArticleModuleCriteria] Failed to delete:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete criterion', details: error.message },
      { status: 500 }
    )
  }
}
