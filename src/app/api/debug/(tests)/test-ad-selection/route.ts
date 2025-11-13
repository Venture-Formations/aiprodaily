import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AdScheduler } from '@/lib/ad-scheduler'

/**
 * Debug endpoint to test advertisement selection and recording
 *
 * Usage:
 * POST /api/debug/test-ad-selection
 * Body: { issue_id: "uuid", date: "2025-11-07" }
 *
 * Or create a test issue:
 * POST /api/debug/test-ad-selection?create_test=true
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const createTest = searchParams.get('create_test') === 'true'

    let body
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    let issueId = body.issue_id
    let date = body.date || new Date().toISOString().split('T')[0]

    // Create a test issue if requested
    if (createTest || !issueId) {
      console.log('[Test Ad] Creating test issue...')

      // Get newsletter ID
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('slug', 'accounting')
        .single()

      if (!newsletter) {
        return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
      }

      const { data: testissue, error: createError } = await supabaseAdmin
        .from('publication_issues')
        .insert([{
          date: date,
          status: 'draft',
          publication_id: newsletter.id
        }])
        .select('id')
        .single()

      if (createError || !testissue) {
        return NextResponse.json({
          error: 'Failed to create test issue',
          details: createError
        }, { status: 500 })
      }

      issueId = testissue.id
      console.log(`[Test Ad] Created test issue: ${issueId}`)
    }

    // Get publication_id from issue
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Test ad selection
    console.log(`[Test Ad] Testing ad selection for issue: ${issueId}`)

    const selectedAd = await AdScheduler.selectAdForissue({
      issueId: issueId,
      issueDate: date,
      newsletterId: issue.publication_id
    })

    if (!selectedAd) {
      return NextResponse.json({
        success: false,
        message: 'No advertisement available',
        issue_id: issueId,
        date: date
      })
    }

    console.log(`[Test Ad] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)

    // Test ad recording
    try {
      await AdScheduler.recordAdUsage(issueId, selectedAd.id, date, issue.publication_id)
      console.log('[Test Ad] Successfully recorded ad usage')
    } catch (recordError) {
      console.error('[Test Ad] Failed to record ad usage:', recordError)
      return NextResponse.json({
        success: false,
        error: 'Failed to record ad usage',
        details: recordError,
        selected_ad: {
          id: selectedAd.id,
          title: selectedAd.title,
          display_order: selectedAd.display_order
        },
        issue_id: issueId,
        publication_id: issue.publication_id
      }, { status: 500 })
    }

    // Verify the ad was recorded (get most recent)
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('issue_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('issue_id', issueId)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (verifyError) {
      console.error('[Test Ad] Verification failed:', verifyError)
    }

    // Check next_ad_position was updated
    const { data: nextPosition } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('publication_id', issue.publication_id)
      .eq('key', 'next_ad_position')
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'Advertisement selection and recording successful',
      issue_id: issueId,
      date: date,
      selected_ad: {
        id: selectedAd.id,
        title: selectedAd.title,
        display_order: selectedAd.display_order,
        status: selectedAd.status
      },
      verification: {
        recorded: !!verification,
        error: verifyError?.message
      },
      next_ad_position: nextPosition?.value,
      test_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/accounting/campaigns/${issueId}`
    })

  } catch (error) {
    console.error('[Test Ad] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}

export const maxDuration = 60
