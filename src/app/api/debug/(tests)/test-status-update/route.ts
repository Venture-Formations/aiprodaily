import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
    }

    console.log('=== STATUS UPDATE DEBUG ===')
    console.log('issue ID:', issueId)

    // Check session
    const session = await getServerSession(authOptions)
    console.log('Session:', {
      exists: !!session,
      user: session?.user?.email || 'none'
    })

    if (!session) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    // Check if issue exists
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .eq('id', issueId)
      .single()

    console.log('issue lookup:', {
      found: !!issue,
      error: issueError?.message || 'none',
      status: issue?.status || 'none'
    })

    if (issueError) {
      return NextResponse.json({
        error: 'issue lookup failed',
        details: issueError.message,
        code: issueError.code
      }, { status: 500 })
    }

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Test the update operation
    console.log('Testing status update...')
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'changes_made',
        last_action: 'changes_made',
        last_action_at: new Date().toISOString(),
        last_action_by: session.user?.email || 'unknown'
      })
      .eq('id', issueId)

    console.log('Update result:', {
      success: !updateError,
      error: updateError?.message || 'none',
      code: updateError?.code || 'none'
    })

    if (updateError) {
      return NextResponse.json({
        error: 'Update failed',
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint || 'none'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Status update test completed successfully',
      issue: {
        id: issueId,
        current_status: issue.status,
        updated_status: 'changes_made'
      }
    })

  } catch (error) {
    console.error('Debug test failed:', error)
    return NextResponse.json({
      error: 'Debug test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'none'
    }, { status: 500 })
  }
}