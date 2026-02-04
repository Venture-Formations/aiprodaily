import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// GET /api/feedback-modules?publication_id={id} - Get feedback module for publication
export async function GET(request: NextRequest) {
  try {
    const publicationId = request.nextUrl.searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { success: false, error: 'publication_id is required' },
        { status: 400 }
      )
    }

    const module = await FeedbackModuleSelector.getFeedbackModule(publicationId)

    return NextResponse.json({
      success: true,
      module
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in GET:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback module' },
      { status: 500 }
    )
  }
}

// POST /api/feedback-modules - Create or update feedback module
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

    // Ensure module exists
    const module = await FeedbackModuleSelector.ensureFeedbackModule(publication_id)

    // If updates provided, apply them
    if (Object.keys(updates).length > 0) {
      const result = await FeedbackModuleSelector.updateModule(module.id, updates)
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
      return NextResponse.json({
        success: true,
        module: result.module
      })
    }

    return NextResponse.json({
      success: true,
      module
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in POST:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create/update feedback module' },
      { status: 500 }
    )
  }
}

// PATCH /api/feedback-modules - Update feedback module
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, publication_id, ...updates } = body

    // Need either id or publication_id to find the module
    if (!id && !publication_id) {
      return NextResponse.json(
        { success: false, error: 'id or publication_id is required' },
        { status: 400 }
      )
    }

    let moduleId = id

    // If publication_id provided, get the module by publication
    if (!moduleId && publication_id) {
      const module = await FeedbackModuleSelector.getFeedbackModule(publication_id)
      if (!module) {
        return NextResponse.json(
          { success: false, error: 'Feedback module not found' },
          { status: 404 }
        )
      }
      moduleId = module.id
    }

    const result = await FeedbackModuleSelector.updateModule(moduleId, updates)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      module: result.module
    })
  } catch (error) {
    console.error('[FeedbackModules] Error in PATCH:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update feedback module' },
      { status: 500 }
    )
  }
}
