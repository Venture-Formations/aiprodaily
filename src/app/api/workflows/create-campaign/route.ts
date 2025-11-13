import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { createIssueWorkflow } from '@/lib/workflows/create-issue-workflow'

/**
 * Create issue Workflow Endpoint
 * Generates articles for an existing issue
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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
  } catch (error) {
    console.error('[Create issue Workflow] Failed:', error)
    return NextResponse.json({
      error: 'Workflow failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 800
