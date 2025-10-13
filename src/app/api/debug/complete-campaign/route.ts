import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    console.log('=== COMPLETING INTERRUPTED CAMPAIGN ===')

    // Get the campaign ID from request body or find latest
    const body = await request.json().catch(() => ({}))
    let campaignId = body.campaignId

    if (!campaignId) {
      // Find the most recent campaign
      const { data: latestCampaign, error } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id, date, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !latestCampaign) {
        return NextResponse.json({
          success: false,
          error: 'No campaign found to complete'
        }, { status: 404 })
      }

      campaignId = latestCampaign.id
      console.log('Found latest campaign:', campaignId, 'Status:', latestCampaign.status)
    }

    // Get campaign with articles
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          headline,
          content,
          is_active,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found',
        campaignId
      }, { status: 404 })
    }

    const fixes = []

    // Fix 1: Reset status to draft
    if (campaign.status !== 'draft') {
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
          status: 'draft',
          review_sent_at: null
        })
        .eq('id', campaignId)

      fixes.push(`Status changed from '${campaign.status}' to 'draft'`)
    }

    // Fix 2: Generate subject line if missing
    let generatedSubject = campaign.subject_line
    if (!campaign.subject_line) {
      console.log('Generating missing subject line...')

      const activeArticles = campaign.articles
        ?.filter((article: any) => article.is_active)
        ?.sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        }) || []

      if (activeArticles.length > 0) {
        const topArticle = activeArticles[0]
        const subjectPrompt = await AI_PROMPTS.subjectLineGenerator([topArticle]) + `\n\nTimestamp: ${new Date().toISOString()}`

        try {
          const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)
          if (aiResponse && aiResponse.trim()) {
            generatedSubject = aiResponse.trim()

            await supabaseAdmin
              .from('newsletter_campaigns')
              .update({
                subject_line: generatedSubject,
                updated_at: new Date().toISOString()
              })
              .eq('id', campaignId)

            fixes.push(`Generated subject line: "${generatedSubject}"`)
          }
        } catch (error) {
          fixes.push('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign completion fixes applied',
      campaignId,
      originalStatus: campaign.status,
      subjectLine: generatedSubject,
      activeArticles: campaign.articles?.filter((a: any) => a.is_active).length || 0,
      totalArticles: campaign.articles?.length || 0,
      fixesApplied: fixes,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Complete campaign error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}