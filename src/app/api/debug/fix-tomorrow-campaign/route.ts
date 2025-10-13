import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('=== FIXING TOMORROW\'S CAMPAIGN ===')

    // Get tomorrow's campaign
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const campaignDate = tomorrow.toISOString().split('T')[0]

    console.log('Fixing campaign for date:', campaignDate)

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
      .eq('date', campaignDate)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found for tomorrow',
        campaignDate
      }, { status: 404 })
    }

    console.log('Found campaign:', campaign.id, 'Status:', campaign.status)

    const fixes = []

    // Fix 1: Reset status to draft
    if (campaign.status !== 'draft') {
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
          status: 'draft',
          review_sent_at: null // Clear previous review timestamp
        })
        .eq('id', campaign.id)

      fixes.push(`Status changed from '${campaign.status}' to 'draft'`)
      console.log('Reset campaign status to draft')
    }

    // Fix 2: Generate subject line if missing
    let generatedSubject = campaign.subject_line
    if (!campaign.subject_line || (typeof campaign.subject_line === 'string' && campaign.subject_line.trim() === '')) {
      console.log('Generating missing subject line...')

      // Get active articles sorted by AI score
      const activeArticles = campaign.articles
        ?.filter((article: any) => article.is_active)
        ?.sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        }) || []

      if (activeArticles.length > 0) {
        // Use the highest scored article for subject line generation
        const topArticle = activeArticles[0] as any
        console.log('Using top article:', topArticle.headline)

        // Generate subject line using AI
        const timestamp = new Date().toISOString()
        const subjectPrompt = await AI_PROMPTS.subjectLineGenerator([topArticle]) + `\n\nTimestamp: ${timestamp}`

        const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

        if (aiResponse && aiResponse.trim()) {
          generatedSubject = aiResponse.trim()
          console.log('Generated subject line:', generatedSubject)

          // Update campaign with generated subject line
          await supabaseAdmin
            .from('newsletter_campaigns')
            .update({
              subject_line: generatedSubject,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id)

          fixes.push(`Generated subject line: "${generatedSubject}"`)
        } else {
          fixes.push('Failed to generate subject line - AI returned empty response')
        }
      } else {
        fixes.push('Cannot generate subject line - no active articles found')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign fixes applied',
      campaignId: campaign.id,
      campaignDate,
      originalStatus: campaign.status,
      originalSubjectLine: campaign.subject_line,
      newSubjectLine: generatedSubject,
      fixesApplied: fixes,
      nextStep: 'Campaign should now be ready for MailerLite creation',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Fix campaign error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}