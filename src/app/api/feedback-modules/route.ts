import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// GET /api/feedback-modules?publication_id={id} - Get feedback mod for publication (with blocks)
export async function GET(request: NextRequest) {
  try {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { success: false, error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Get mod with blocks
    const mod = await FeedbackModuleSelector.getFeedbackModuleWithBlocks(publicationId)

    return NextResponse.json({
      success: true,
      mod
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in GET:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback mod' },
      { status: 500 }
    )
  }
}

// POST /api/feedback-modules - Create or update feedback mod (returns with blocks)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publication_id, ...updates } = body

    if (!publication_id) {
      return NextResponse.json(
        { success: false, error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Ensure mod exists (creates with default blocks if new)
    let mod = await FeedbackModuleSelector.ensureFeedbackModule(publication_id)

    // If updates provided, apply them
    if (Object.keys(updates).length > 0) {
      const result = await FeedbackModuleSelector.updateModule(mod.id, updates)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
      // Refetch with blocks
      mod = await FeedbackModuleSelector.getFeedbackModuleWithBlocks(publication_id) as any
    }

    return NextResponse.json({
      success: true,
      mod
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in POST:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create/update feedback mod' },
      { status: 500 }
    )
  }
}

// PATCH /api/feedback-modules - Update feedback mod (returns with blocks)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, publication_id, ...updates } = body

    // Need either id or publication_id to find the mod
    if (!id && !publication_id) {
      return NextResponse.json(
        { success: false, error: 'id or publication_id is required' },
        { status: 400 }
      )
    }

    let moduleId = id
    let pubId = publication_id

    // If publication_id provided, get the mod by publication
    if (!moduleId && publication_id) {
      const mod = await FeedbackModuleSelector.getFeedbackModule(publication_id)
      if (!mod) {
        return NextResponse.json(
          { success: false, error: 'Feedback mod not found' },
          { status: 404 }
        )
      }
      moduleId = mod.id
      pubId = mod.publication_id
    }

    // Get publication_id from existing mod if not provided
    if (!pubId) {
      const existingModule = await FeedbackModuleSelector.getFeedbackModule(moduleId)
      if (existingModule) {
        pubId = existingModule.publication_id
      }
    }

    const result = await FeedbackModuleSelector.updateModule(moduleId, updates)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Refetch with blocks for complete response
    const moduleWithBlocks = pubId
      ? await FeedbackModuleSelector.getFeedbackModuleWithBlocks(pubId)
      : result.mod

    return NextResponse.json({
      success: true,
      mod: moduleWithBlocks
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in PATCH:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update feedback mod' },
      { status: 500 }
    )
  }
}
