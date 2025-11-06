import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  generateNewsletterHeader,
  generateNewsletterFooter,
  generateWelcomeSection,
  generatePrimaryArticlesSection,
  generateSecondaryArticlesSection,
  generateAdvertorialSection,
  generatePollSection,
  generateBreakingNewsSection,
  generateBeyondTheFeedSection,
  generatePromptIdeasSection,
  generateAIAppsSection
} from '@/lib/newsletter-templates'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    console.log('Preview API called')
    const { id } = await props.params
    console.log('Campaign ID:', id)

    const session = await getServerSession(authOptions)
    console.log('Session check:', !!session?.user?.email)

    if (!session?.user?.email) {
      console.log('Authorization failed - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching campaign with ID:', id)
    // Fetch campaign with active articles and events
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles(
          id,
          headline,
          content,
          word_count,
          fact_check_score,
          is_active,
          rank,
          rss_post:rss_posts(
            source_url,
            image_url,
            author,
            rss_feed:rss_feeds(name)
          )
        ),
        campaign_events(
          id,
          event_date,
          is_selected,
          is_featured,
          display_order,
          event:events(
            id,
            title,
            description,
            event_summary,
            start_date,
            end_date,
            venue,
            address,
            url,
            image_url,
            cropped_image_url
          )
        )
      `)
      .eq('id', id)
      .single()

    console.log('Campaign query result:', { campaign: !!campaign, error: campaignError })

    if (campaignError) {
      console.error('Campaign fetch error:', campaignError)
      return NextResponse.json({ error: `Campaign fetch failed: ${campaignError.message}` }, { status: 404 })
    }

    if (!campaign) {
      console.log('No campaign found')
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log('Campaign found, articles count:', campaign.articles?.length || 0)
    console.log('Campaign events count:', campaign.campaign_events?.length || 0)

    // Filter to only active articles (max 5)
    if (campaign.articles) {
      const beforeFilter = campaign.articles.length
      campaign.articles = campaign.articles
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => (b.rss_post?.post_rating?.[0]?.total_score || 0) - (a.rss_post?.post_rating?.[0]?.total_score || 0))
        .slice(0, 5) // Limit to 5 articles maximum
      console.log('Active articles after filter:', campaign.articles.length, 'from', beforeFilter, '(max 5)')
    }

    // Filter to only selected events and group by date
    const eventsData = (campaign.campaign_events || [])
      .filter((ce: any) => ce.is_selected && ce.event)
      .sort((a: any, b: any) => (a.display_order || 999) - (b.display_order || 999))
    console.log('Selected events after filter:', eventsData.length)

    console.log('Generating HTML newsletter')
    // Generate HTML newsletter
    const newsletterHtml = await generateNewsletterHtml(campaign)
    console.log('HTML generated, length:', newsletterHtml.length)

    return NextResponse.json({
      success: true,
      campaign,
      html: newsletterHtml
    })

  } catch (error) {
    console.error('Preview generation error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Failed to generate newsletter preview: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

async function generateNewsletterHtml(campaign: any): Promise<string> {
  try {
    console.log('Generating HTML for campaign:', campaign?.id)

    // Filter active articles and sort by rank (custom order)
    const activeArticles = (campaign.articles || [])
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

    console.log('PREVIEW - Active articles to render:', activeArticles.length)
    console.log('PREVIEW - Article order:', activeArticles.map((a: any) => `${a.headline} (rank: ${a.rank})`).join(', '))
    console.log('PREVIEW - Raw article data:', activeArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Active: ${a.is_active}`).join(' | '))

    console.log('Generating events section using calculated dates...')

    // Fetch newsletter sections order
    const { data: sections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    console.log('Active newsletter sections:', sections?.map(s => `${s.name} (order: ${s.display_order})`).join(', '))

    const formatDate = (dateString: string) => {
      try {
        // Parse date as local date to avoid timezone offset issues
        const [year, month, day] = dateString.split('-').map(Number)
        const date = new Date(year, month - 1, day) // month is 0-indexed
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch (e) {
        console.error('Date formatting error:', e)
        return dateString
      }
    }

    const formattedDate = formatDate(campaign.date)
    console.log('Formatted date:', formattedDate)

    // Generate modular HTML sections with tracking parameters
    // mailerlite_campaign_id might not exist yet, so it's optional
    const mailerliteId = (campaign as any).mailerlite_campaign_id || undefined
    const header = await generateNewsletterHeader(formattedDate, campaign.date, mailerliteId)
    const footer = await generateNewsletterFooter(campaign.date, mailerliteId)

    // Generate welcome section (if it exists)
    const welcomeHtml = await generateWelcomeSection(
      campaign.welcome_intro || null,
      campaign.welcome_tagline || null,
      campaign.welcome_summary || null
    )

    // Section ID constants (reference IDs from newsletter_sections table)
    // These IDs are stable and won't change even if section names are updated
    const SECTION_IDS = {
      AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
      PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
      ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d'
    }

    // Generate sections in order based on database configuration
    let sectionsHtml = ''
    if (sections && sections.length > 0) {
      for (const section of sections) {
        // Check if this is a primary articles section (display_order 3)
        if (section.display_order === 3 && activeArticles.length > 0) {
          const primaryHtml = await generatePrimaryArticlesSection(activeArticles, campaign.date, campaign.id, section.name)
          sectionsHtml += primaryHtml
        }
        // Check if this is a secondary articles section (display_order 5)
        else if (section.display_order === 5) {
          const secondaryHtml = await generateSecondaryArticlesSection(campaign, section.name)
          sectionsHtml += secondaryHtml
        }
        // Use section ID for AI Applications (stable across name changes)
        else if (section.id === SECTION_IDS.AI_APPLICATIONS) {
          const aiAppsHtml = await generateAIAppsSection(campaign)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        // Use section ID for Prompt Ideas (stable across name changes)
        else if (section.id === SECTION_IDS.PROMPT_IDEAS) {
          const promptHtml = await generatePromptIdeasSection(campaign)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        // Legacy name-based matching for other sections
        else if (section.name === 'Poll') {
          const pollHtml = await generatePollSection(campaign.id)
          if (pollHtml) {
            sectionsHtml += pollHtml
          }
        } else if (section.name === 'Breaking News') {
          const breakingNewsHtml = await generateBreakingNewsSection(campaign)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        } else if (section.name === 'Beyond the Feed') {
          const beyondFeedHtml = await generateBeyondTheFeedSection(campaign)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
        // Use section ID for Advertisement (stable across name changes)
        else if (section.id === SECTION_IDS.ADVERTISEMENT) {
          const advertorialHtml = await generateAdvertorialSection(campaign, false, section.name) // Don't record usage during preview, pass section name
          if (advertorialHtml) {
            sectionsHtml += advertorialHtml
          }
        }
      }
    } else {
      // Fallback to default order if no sections configured
      console.log('No sections found, using default order')
      sectionsHtml = ''
    }

    // Combine all sections (welcome section goes after header, before all other sections)
    const html = header + welcomeHtml + sectionsHtml + footer

    console.log('HTML template generated successfully, length:', html.length)
    return html

  } catch (error) {
    console.error('HTML generation error:', error)
    throw new Error(`HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}