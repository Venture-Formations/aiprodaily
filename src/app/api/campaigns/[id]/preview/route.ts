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
    console.log('issue ID:', id)

    const session = await getServerSession(authOptions)
    console.log('Session check:', !!session?.user?.email)

    if (!session?.user?.email) {
      console.log('Authorization failed - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching issue with ID:', id)
    // Fetch issue with active articles and events
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
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
        issue_events(
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

    console.log('issue query result:', { issue: !!issue, error: issueError })

    if (issueError) {
      console.error('issue fetch error:', issueError)
      return NextResponse.json({ error: `issue fetch failed: ${issueError.message}` }, { status: 404 })
    }

    if (!issue) {
      console.log('No issue found')
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    console.log('issue found, articles count:', issue.articles?.length || 0)
    console.log('issue events count:', issue.issue_events?.length || 0)

    // Filter to only active articles (max 5)
    if (issue.articles) {
      const beforeFilter = issue.articles.length
      issue.articles = issue.articles
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => (b.rss_post?.post_rating?.[0]?.total_score || 0) - (a.rss_post?.post_rating?.[0]?.total_score || 0))
        .slice(0, 5) // Limit to 5 articles maximum
      console.log('Active articles after filter:', issue.articles.length, 'from', beforeFilter, '(max 5)')
    }

    // Filter to only selected events and group by date
    const eventsData = (issue.issue_events || [])
      .filter((ce: any) => ce.is_selected && ce.event)
      .sort((a: any, b: any) => (a.display_order || 999) - (b.display_order || 999))
    console.log('Selected events after filter:', eventsData.length)

    console.log('Generating HTML newsletter')
    // Generate HTML newsletter
    const newsletterHtml = await generateNewsletterHtml(issue)
    console.log('HTML generated, length:', newsletterHtml.length)

    return NextResponse.json({
      success: true,
      issue,
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

async function generateNewsletterHtml(issue: any): Promise<string> {
  try {
    console.log('Generating HTML for issue:', issue?.id)

    // Filter active articles and sort by rank (custom order)
    const activeArticles = (issue.articles || [])
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

    const formattedDate = formatDate(issue.date)
    console.log('Formatted date:', formattedDate)

    // Generate modular HTML sections with tracking parameters
    // mailerlite_issue_id might not exist yet, so it's optional
    const mailerliteId = (issue as any).mailerlite_issue_id || undefined
    const header = await generateNewsletterHeader(formattedDate, issue.date, mailerliteId)
    const footer = await generateNewsletterFooter(issue.date, mailerliteId)

    // Generate welcome section (if it exists)
    const welcomeHtml = await generateWelcomeSection(
      issue.welcome_intro || null,
      issue.welcome_tagline || null,
      issue.welcome_summary || null
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
        // Check section_type to determine what to render
        if (section.section_type === 'primary_articles' && activeArticles.length > 0) {
          const primaryHtml = await generatePrimaryArticlesSection(activeArticles, issue.date, issue.id, section.name)
          sectionsHtml += primaryHtml
        }
        else if (section.section_type === 'secondary_articles') {
          const secondaryHtml = await generateSecondaryArticlesSection(issue, section.name)
          sectionsHtml += secondaryHtml
        }
        else if (section.section_type === 'ai_applications' || section.id === SECTION_IDS.AI_APPLICATIONS) {
          const aiAppsHtml = await generateAIAppsSection(issue)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        else if (section.section_type === 'prompt_ideas' || section.id === SECTION_IDS.PROMPT_IDEAS) {
          const promptHtml = await generatePromptIdeasSection(issue)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        else if (section.section_type === 'poll') {
          const pollHtml = await generatePollSection(issue)
          if (pollHtml) {
            sectionsHtml += pollHtml
          }
        }
        else if (section.section_type === 'breaking_news') {
          const breakingNewsHtml = await generateBreakingNewsSection(issue)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        }
        else if (section.section_type === 'beyond_the_feed') {
          const beyondFeedHtml = await generateBeyondTheFeedSection(issue)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
        else if (section.section_type === 'advertorial' || section.id === SECTION_IDS.ADVERTISEMENT) {
          const advertorialHtml = await generateAdvertorialSection(issue, false, section.name) // Don't record usage during preview, pass section name
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