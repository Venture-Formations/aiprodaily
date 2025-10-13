import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`Fetching feedback analytics for last ${days} days`)

    // Fetch feedback responses within date range
    const { data: responses, error } = await supabaseAdmin
      .from('feedback_responses')
      .select('*')
      .gte('campaign_date', startDate.toISOString().split('T')[0])
      .lte('campaign_date', endDate.toISOString().split('T')[0])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching feedback responses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate section popularity
    const sectionCounts: { [key: string]: number } = {}
    responses?.forEach(response => {
      sectionCounts[response.section_choice] = (sectionCounts[response.section_choice] || 0) + 1
    })

    // Calculate daily response counts
    const dailyResponses: { [key: string]: number } = {}
    responses?.forEach(response => {
      const date = response.campaign_date
      dailyResponses[date] = (dailyResponses[date] || 0) + 1
    })

    // Calculate MailerLite sync success rate
    const totalResponses = responses?.length || 0
    const successfulSyncs = responses?.filter(r => r.mailerlite_updated).length || 0
    const syncSuccessRate = totalResponses > 0 ? (successfulSyncs / totalResponses) * 100 : 0

    // Get most recent responses
    const recentResponses = responses?.slice(0, 10)

    return NextResponse.json({
      success: true,
      analytics: {
        totalResponses,
        successfulSyncs,
        syncSuccessRate,
        sectionCounts,
        dailyResponses,
        recentResponses,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      }
    })

  } catch (error) {
    console.error('Feedback analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
