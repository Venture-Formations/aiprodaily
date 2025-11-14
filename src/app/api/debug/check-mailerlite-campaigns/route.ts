import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    console.log(`[Debug] Found ${storedMetrics?.length || 0} stored mailerlite_issue_ids`)

    // Query MailerLite API to list campaigns
    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log('[Debug] Querying MailerLite API for campaigns...')
    
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
      console.error('[Debug] Error fetching campaigns from MailerLite:', error.response?.data || error.message)
      return NextResponse.json({
        error: 'Failed to fetch campaigns from MailerLite',
        mailerliteError: error.response?.data || error.message,
        storedIds: storedMetrics?.map(m => ({ issue_id: m.issue_id, mailerlite_id: m.mailerlite_issue_id }))
      }, { status: 500 })
    }

    console.log(`[Debug] Found ${mailerliteCampaigns.length} campaigns in MailerLite`)

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

  } catch (error) {
    console.error('[Debug] Error:', error)
    return NextResponse.json({
      error: 'Failed to check MailerLite campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

