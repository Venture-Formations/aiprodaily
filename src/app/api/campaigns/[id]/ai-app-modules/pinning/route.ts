import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/campaigns/[id]/ai-app-modules/pinning
 * Updates per-issue pinning overrides for an AI app module
 *
 * Body:
 * {
 *   module_id: string - AI app module ID
 *   pinned_overrides: Record<string, number | null> - {app_id: position or null to unpin}
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params
    const body = await request.json()
    const { module_id, pinned_overrides } = body

    if (!module_id) {
      return NextResponse.json(
        { error: 'module_id is required' },
        { status: 400 }
      )
    }

    if (!pinned_overrides || typeof pinned_overrides !== 'object') {
      return NextResponse.json(
        { error: 'pinned_overrides must be an object' },
        { status: 400 }
      )
    }

    // Validate all position values (must be 1-20 or null)
    for (const [appId, position] of Object.entries(pinned_overrides)) {
      if (position !== null) {
        const pos = position as number
        if (typeof pos !== 'number' || pos < 1 || pos > 20) {
          return NextResponse.json(
            { error: `Invalid position ${pos} for app ${appId}. Must be 1-20 or null.` },
            { status: 400 }
          )
        }
      }
    }

    // Check if selection exists for this issue/module
    const { data: existingSelection } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('id, pinned_overrides')
      .eq('issue_id', issueId)
      .eq('ai_app_module_id', module_id)
      .single()

    if (!existingSelection) {
      // Create new selection record with pinned overrides
      const { data: newSelection, error: insertError } = await supabaseAdmin
        .from('issue_ai_app_modules')
        .insert({
          issue_id: issueId,
          ai_app_module_id: module_id,
          app_ids: [],
          pinned_overrides,
          selected_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      console.log(`[AIAppModules] Created pinning overrides for issue ${issueId}, module ${module_id}`)
      return NextResponse.json({
        success: true,
        selection: newSelection
      })
    }

    // Update existing selection's pinned_overrides
    const { data: updatedSelection, error: updateError } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .update({
        pinned_overrides
      })
      .eq('id', existingSelection.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    console.log(`[AIAppModules] Updated pinning overrides for issue ${issueId}, module ${module_id}`)
    return NextResponse.json({
      success: true,
      selection: updatedSelection
    })

  } catch (error) {
    console.error('Failed to update pinning overrides:', error)
    return NextResponse.json({
      error: 'Failed to update pinning overrides',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/campaigns/[id]/ai-app-modules/pinning
 * Gets per-issue pinning overrides for all modules
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

    // Fetch all selections with pinned_overrides for this issue
    const { data: selections, error } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('ai_app_module_id, pinned_overrides')
      .eq('issue_id', issueId)

    if (error) {
      throw error
    }

    // Convert to a map of module_id -> pinned_overrides
    const pinningByModule: Record<string, Record<string, number | null>> = {}
    for (const selection of selections || []) {
      pinningByModule[selection.ai_app_module_id] = selection.pinned_overrides || {}
    }

    return NextResponse.json({
      success: true,
      pinning: pinningByModule
    })

  } catch (error) {
    console.error('Failed to fetch pinning overrides:', error)
    return NextResponse.json({
      error: 'Failed to fetch pinning overrides',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
