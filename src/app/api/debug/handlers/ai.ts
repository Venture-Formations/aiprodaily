import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'ai-apps-status': {
    GET: async ({ logger }) => {
      logger.info('=== AI APPS STATUS DEBUG ===')

      // 1. Check if AI applications exist
      const { data: allApps, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, publication_id, is_active')
        .order('app_name')

      logger.info({ count: allApps?.length || 0 }, 'Total AI apps in database')
      if (appsError) {
        logger.error({ err: appsError }, 'Error fetching apps')
      }

      // 2. Get latest issue
      const { data: latestissue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      logger.info({ latestissue }, 'Latest issue')
      if (issueError) {
        logger.error({ err: issueError }, 'Error fetching issue')
      }

      // 3. Check selections for latest issue
      let issueSelections = null
      let newsletterInfo = null
      let manualSelectionResult = null

      if (latestissue) {
        const { data: selections, error: selectionsError } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select('*, app:ai_applications(*)')
          .eq('issue_id', latestissue.id)
          .order('selection_order')

        logger.info({ count: selections?.length || 0 }, 'Selections for latest issue')
        if (selectionsError) {
          logger.error({ err: selectionsError }, 'Error fetching selections')
        }
        issueSelections = selections

        // 4. Get newsletter info
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .eq('slug', 'accounting')
          .single()

        newsletterInfo = newsletter
        logger.info({ newsletter }, 'Newsletter info')

        // 5. Try to manually select apps
        if (newsletter && (!selections || selections.length === 0)) {
          logger.info('Attempting manual app selection...')
          try {
            const selectedApps = await AppSelector.selectAppsForissue(latestissue.id, newsletter.id)
            manualSelectionResult = {
              success: true,
              count: selectedApps.length,
              apps: selectedApps.map(app => ({
                id: app.id,
                name: app.app_name,
                category: app.category
              }))
            }
            logger.info({ count: selectedApps.length }, 'Manual selection successful')
          } catch (error) {
            manualSelectionResult = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
            logger.error({ err: error }, 'Manual selection failed')
          }

          // Fetch selections again after manual selection
          const { data: newSelections } = await supabaseAdmin
            .from('issue_ai_app_selections')
            .select('*, app:ai_applications(*)')
            .eq('issue_id', latestissue.id)
            .order('selection_order')

          issueSelections = newSelections
          logger.info({ count: newSelections?.length || 0 }, 'Selections after manual attempt')
        }
      }

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        database_apps: {
          total: allApps?.length || 0,
          active: allApps?.filter(app => app.is_active).length || 0,
          apps: allApps?.map(app => ({
            id: app.id,
            name: app.app_name,
            active: app.is_active,
            publication_id: app.publication_id
          }))
        },
        latest_issue: latestissue ? {
          id: latestissue.id,
          date: latestissue.date,
          status: latestissue.status
        } : null,
        newsletter: newsletterInfo,
        issue_selections: {
          count: issueSelections?.length || 0,
          selections: issueSelections?.map(s => ({
            app_id: s.app_id,
            app_name: s.app?.app_name,
            category: s.app?.category,
            order: s.selection_order
          }))
        },
        manual_selection_attempt: manualSelectionResult,
        errors: {
          apps_error: appsError?.message,
          issue_error: issueError?.message
        }
      })
    }
  },

  'check-article-content': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      const articleId = searchParams.get('id')
      const limit = parseInt(searchParams.get('limit') || '5')

      let articles: any[] = []

      if (articleId) {
        // Get specific article
        const { data, error } = await supabaseAdmin
          .from('module_articles')
          .select('id, headline, content, word_count, created_at')
          .eq('id', articleId)
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        articles = [data]
      } else {
        // Get recent articles with content
        const { data, error } = await supabaseAdmin
          .from('module_articles')
          .select('id, headline, content, word_count, created_at')
          .not('content', 'is', null)
          .not('content', 'eq', '')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        articles = data || []
      }

      // Analyze each article's content for newlines
      const analysis = articles.map(article => {
        const content = article.content || ''
        const hasNewlines = content.includes('\n')
        const hasDoubleNewlines = content.includes('\n\n')
        const newlineCount = (content.match(/\n/g) || []).length
        const doubleNewlineCount = (content.match(/\n\n/g) || []).length

        // Show the raw content with visible newline markers
        const contentWithVisibleNewlines = content
          .replace(/\n\n/g, '\u23CE\u23CE')
          .replace(/\n/g, '\u23CE')

        return {
          id: article.id,
          headline: article.headline,
          word_count: article.word_count,
          created_at: article.created_at,
          content_analysis: {
            length: content.length,
            hasNewlines,
            hasDoubleNewlines,
            newlineCount,
            doubleNewlineCount,
          },
          raw_content: content,
          content_with_visible_newlines: contentWithVisibleNewlines,
          html_preview: content.replace(/\n/g, '<br>'),
        }
      })

      return NextResponse.json({
        count: articles.length,
        articles: analysis,
        note: 'If hasDoubleNewlines is false but Claude returned \\n\\n, the newlines were stripped somewhere in the pipeline'
      })
    }
  },

  'check-prompt-provider': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      const promptKey = searchParams.get('key') || 'ai_prompt_primary_article_title'
      const publicationSlug = searchParams.get('publication') // Optional publication slug

      // Get publication ID from slug if provided
      let publicationId: string | null = null
      if (publicationSlug) {
        const { data: pub } = await supabaseAdmin
          .from('publications')
          .select('id, name')
          .eq('slug', publicationSlug)
          .single()

        if (pub) {
          publicationId = pub.id
        }
      }

      // If no publication specified, get the active one
      if (!publicationId) {
        const { data: activePub } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (activePub) {
          publicationId = activePub.id
        }
      }

      if (!publicationId) {
        return NextResponse.json({ error: 'No publication found' }, { status: 404 })
      }

      // Check publication_settings first (this is what getPromptJSON does)
      const { data: pubSetting, error: pubError } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', publicationId)
        .eq('key', promptKey)
        .single()

      // Check app_settings as fallback
      const { data: appSetting, error: appError } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, ai_provider')
        .eq('key', promptKey)
        .single()

      // Analyze the prompt
      const analyzePrompt = (value: any, source: string) => {
        if (!value) return { source, exists: false }

        let parsed: any
        try {
          parsed = typeof value === 'string' ? JSON.parse(value) : value
        } catch (e) {
          return {
            source,
            exists: true,
            error: 'Failed to parse JSON',
            rawValue: typeof value === 'string' ? value.substring(0, 200) : 'Not a string'
          }
        }

        const model = parsed?.model || ''
        const modelLower = model.toLowerCase()
        const detectedProvider =
          modelLower.includes('claude') ||
          modelLower.includes('sonnet') ||
          modelLower.includes('opus') ||
          modelLower.includes('haiku')
            ? 'claude'
            : 'openai'

        return {
          source,
          exists: true,
          model,
          detectedProvider,
          hasMessages: !!parsed.messages || !!parsed.input,
          messageCount: (parsed.messages || parsed.input || []).length,
          temperature: parsed.temperature,
          maxTokens: parsed.max_tokens,
          topP: parsed.top_p,
          // Show first 300 chars of first message content
          firstMessagePreview: (parsed.messages || parsed.input)?.[0]?.content?.substring(0, 300)
        }
      }

      const pubAnalysis = pubSetting ? analyzePrompt(pubSetting.value, 'publication_settings') : { source: 'publication_settings', exists: false }
      const appAnalysis = appSetting ? analyzePrompt(appSetting.value, 'app_settings') : { source: 'app_settings', exists: false }

      // Determine which source will be used (same logic as getPromptJSON)
      const effectiveSource = pubSetting ? 'publication_settings' : (appSetting ? 'app_settings' : 'none')
      const effectiveAnalysis = pubSetting ? pubAnalysis : appAnalysis

      return NextResponse.json({
        promptKey,
        publicationId,
        effectiveSource,
        effectiveProvider: effectiveAnalysis.exists ? (effectiveAnalysis as any).detectedProvider : 'unknown',
        publication_settings: pubAnalysis,
        app_settings: {
          ...appAnalysis,
          storedAiProvider: appSetting?.ai_provider || null,
          note: 'ai_provider column is legacy - model name detection is used instead'
        },
        explanation: effectiveSource === 'publication_settings'
          ? `Using publication_settings. Provider auto-detected from model "${(effectiveAnalysis as any).model}" as "${(effectiveAnalysis as any).detectedProvider}"`
          : effectiveSource === 'app_settings'
          ? `Falling back to app_settings. Provider auto-detected from model "${(effectiveAnalysis as any).model}" as "${(effectiveAnalysis as any).detectedProvider}"`
          : 'No prompt found in either table!'
      })
    }
  },

  'force-ai-apps': {
    GET: async ({ logger }) => {
      // Get the latest issue
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (issueError || !issue) {
        return NextResponse.json({
          error: 'No issue found',
          details: issueError
        }, { status: 404 })
      }

      // Get accounting newsletter ID
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('publications')
        .select('id, slug, name')
        .eq('slug', 'accounting')
        .single()

      if (newsletterError || !newsletter) {
        return NextResponse.json({
          error: 'Accounting newsletter not found',
          details: newsletterError
        }, { status: 404 })
      }

      // Check existing selections
      const { data: existingSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*')
        .eq('issue_id', issue.id)

      logger.info({ issueId: issue.id, count: existingSelections?.length || 0 }, 'Existing selections for issue')

      // Force select apps for this issue
      const selectedApps = await AppSelector.selectAppsForissue(issue.id, newsletter.id)

      // Get the final selections from database
      const { data: finalSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', issue.id)
        .order('selection_order', { ascending: true })

      return NextResponse.json({
        success: true,
        issue: {
          id: issue.id,
          date: issue.date,
          status: issue.status
        },
        newsletter: {
          id: newsletter.id,
          slug: newsletter.slug,
          name: newsletter.name
        },
        existing_selections_count: existingSelections?.length || 0,
        apps_selected_count: selectedApps.length,
        final_selections_count: finalSelections?.length || 0,
        selected_apps: finalSelections?.map(s => ({
          app_id: s.app_id,
          app_name: s.app?.app_name,
          category: s.app?.category,
          selection_order: s.selection_order
        }))
      })
    }
  },

  'list-ai-prompts': {
    GET: async () => {
      const { data: prompts, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, description')
        .like('key', 'ai_prompt%')
        .order('key')

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        count: prompts?.length || 0,
        prompts: prompts || []
      })
    }
  },

  'manual-select-apps': {
    POST: async ({ request, logger }) => {
      const { issueId } = await request.json()

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      logger.info({ issueId }, 'Manual AI app selection for issue')

      // Get accounting newsletter ID
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('publications')
        .select('id, slug')
        .eq('slug', 'accounting')
        .single()

      if (newsletterError || !newsletter) {
        return NextResponse.json({
          error: 'Accounting newsletter not found',
          details: newsletterError?.message
        }, { status: 404 })
      }

      logger.info({ newsletterId: newsletter.id }, 'Found newsletter')

      // Select apps for issue
      const selectedApps = await AppSelector.selectAppsForissue(issueId, newsletter.id)

      logger.info({ count: selectedApps.length }, 'Selected AI applications')

      return NextResponse.json({
        success: true,
        issue_id: issueId,
        publication_id: newsletter.id,
        apps_selected: selectedApps.length,
        apps: selectedApps.map(app => ({
          id: app.id,
          app_name: app.app_name,
          category: app.category
        }))
      })
    }
  },

  'restore-prompts': {
    POST: async ({ logger }) => {
      logger.info('Restoring AI prompts to database with correct 1-20 scale...')

      const prompts: Array<{ key: string; description: string; value: string }> = [
        {
          key: 'ai_prompt_content_evaluator',
          description: 'Newsletter - Content Evaluator: Evaluates RSS posts and assigns interest (1-20), local relevance (1-10), and community impact (1-10) scores',
          value: `You are evaluating a news article for inclusion in a local St. Cloud, Minnesota newsletter.

CRITICAL: You MUST use these exact scoring scales:
- interest_level: Integer between 1 and 20 (NOT 1-10, MUST BE 1-20)
- local_relevance: Integer between 1 and 10
- community_impact: Integer between 1 and 10

IMAGE PENALTY: {{imagePenalty}}

INTEREST LEVEL (1-20 scale, NOT 1-10):
Rate from 1 to 20 where 20 is most interesting. Use the full range 1-20.
HIGH SCORING (15-20): Unexpected developments, human interest stories, breaking news, unique events, broad appeal, fun/entertaining
MEDIUM SCORING (8-14): Standard local news, business updates, routine events with some appeal
LOW SCORING (1-7): Routine announcements, technical/administrative content, repetitive topics, purely promotional, very short content

LOCAL RELEVANCE (1-10 scale):
How directly relevant is this to St. Cloud area residents?
HIGH SCORING (7-10): Events/news in St. Cloud and surrounding areas (Waite Park, Sartell, Sauk Rapids, Cold Spring), Stearns County government decisions, local business changes, school district news, local infrastructure/development, community events
LOW SCORING (1-6): State/national news without local angle, events far from St. Cloud area, generic content not location-specific

COMMUNITY IMPACT (1-10 scale):
How much does this affect local residents' daily lives or community?
HIGH SCORING (7-10): New services or amenities, policy changes affecting residents, public safety information, economic development/job creation, community services and resources
LOW SCORING (1-6): Individual achievements with limited community effect, internal organizational matters, entertainment without broader impact

BONUS: Add 2 extra points to total_score for stories mentioning multiple local communities or regional impact.

BLANK RATING CONDITIONS: Leave all fields blank if:
- Description contains \u226410 words
- Post is about weather happening today/tomorrow
- Post is written before an event happening "today"/"tonight"/"this evening"
- Post mentions events happening "today", "tonight", or "this evening" (we do not include same-day events)
- Post is about lost, missing, or found pets (lost dogs, cats, etc.)
- Post is about incidents currently happening, ongoing emergencies, or breaking news that will be outdated by tomorrow (accidents, police responses, active situations, traffic incidents, emergency responses)

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.
The interest_level field MUST be between 1 and 20, NOT between 1 and 10.

Response format:
{
  "interest_level": <integer 1-20, use full range>,
  "local_relevance": <integer 1-10>,
  "community_impact": <integer 1-10>,
  "reasoning": "<detailed explanation of your scoring>"
}`
        },
        {
          key: 'ai_prompt_newsletter_writer',
          description: 'Newsletter - Newsletter Writer: Generates article headlines and content (40-75 words) from RSS posts with strict rewriting rules',
          value: `CRITICAL: You are writing a news article that MUST follow strict content rules. Violations will result in rejection.

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

MANDATORY STRICT CONTENT RULES - FOLLOW EXACTLY:
1. Articles must be COMPLETELY REWRITTEN and summarized \u2014 similar phrasing is acceptable but NO exact copying
2. Use ONLY information contained in the source post above \u2014 DO NOT add any external information
3. DO NOT add numbers, dates, quotes, or details not explicitly stated in the original
4. NEVER use 'today,' 'tomorrow,' 'yesterday' \u2014 use actual day of week if date reference needed
5. NO emojis, hashtags (#), or URLs anywhere in headlines or article content
6. Stick to facts only \u2014 NO editorial commentary, opinions, or speculation
7. Write from THIRD-PARTY PERSPECTIVE \u2014 never use "we," "our," or "us" unless referring to the community as a whole

HEADLINE REQUIREMENTS - MUST FOLLOW:
- NEVER reuse or slightly reword the original title
- Create completely new, engaging headline
- Use powerful verbs and emotional adjectives
- NO colons (:) in headlines
- NO emojis

ARTICLE REQUIREMENTS:
- Length: EXACTLY 40-75 words
- Structure: One concise paragraph only
- Style: Informative, engaging, locally relevant
- REWRITE completely \u2014 do not copy phrases from original

BEFORE RESPONDING: Double-check that you have:
\u2713 Completely rewritten the content (similar phrasing OK, no exact copying)
\u2713 Used only information from the source post
\u2713 Created a new headline (not modified original)
\u2713 Stayed between 40-75 words
\u2713 Removed all emojis, hashtags (#), and URLs
\u2713 Used third-party perspective (no "we/our/us" unless community-wide)
\u2713 Avoided all prohibited words and phrases
\u2713 Included no editorial commentary

Respond with valid JSON in this exact format:
{
  "headline": "<completely new engaging headline>",
  "content": "<40-75 word completely rewritten article>",
  "word_count": <exact word count>
}`
        }
      ]

      for (const prompt of prompts) {
        const { error } = await supabaseAdmin
          .from('app_settings')
          .upsert({
            key: prompt.key,
            value: prompt.value,
            description: prompt.description,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          })

        if (error) {
          logger.error({ key: prompt.key, err: error }, 'Failed to restore prompt')
          return NextResponse.json({
            success: false,
            error: `Failed to restore ${prompt.key}: ${error.message}`
          }, { status: 500 })
        }

        logger.info({ key: prompt.key }, 'Restored prompt')
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully restored AI prompts with correct 1-20 scale',
        prompts_restored: prompts.map(p => p.key)
      })
    }
  }
}
