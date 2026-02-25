import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { createIssueWorkflow } from '@/lib/workflows/create-issue-workflow'

/**
 * Create issue Workflow Endpoint
 * Generates articles for an existing issue
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'workflows/create-campaign' },
  async ({ request }) => {
    const body = await request.json()
    const { issue_id, publication_id } = body

    if (!issue_id || !publication_id) {
      return NextResponse.json({
        error: 'issue_id and publication_id are required'
      }, { status: 400 })
    }

    console.log(`[Create issue Workflow] Starting for issue: ${issue_id}`)

    // Start the workflow using the API from workflow/api
    await start(createIssueWorkflow, [{
      issue_id,
      publication_id
    }])

    console.log(`[Create issue Workflow] Started successfully`)

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      issue_id,
      publication_id,
      timestamp: new Date().toISOString()
    })
  }
)

export const maxDuration = 800
