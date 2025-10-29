import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

/**
 * Migration endpoint to populate app_settings with AI prompts from fallbacks
 *
 * This ensures the AI Prompt settings page is the single source of truth.
 * After running this, all prompts should exist in the database.
 *
 * Usage: GET /api/debug/migrate-ai-prompts?dry_run=true
 *
 * Set dry_run=false to actually insert prompts
 */

// Define all AI prompts that should exist
const REQUIRED_PROMPTS = [
  {
    key: 'ai_prompt_content_evaluator',
    description: 'Scores RSS posts for interest, relevance, and community impact',
    placeholders: ['{{title}}', '{{description}}', '{{content}}', '{{imagePenalty}}'],
    default_provider: 'openai',
    fallback: `You are evaluating a news article for inclusion in a local St. Cloud, Minnesota newsletter.

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
- Description contains ≤10 words
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
    key: 'ai_prompt_topic_deduper',
    description: 'Groups duplicate/similar articles from RSS feeds',
    placeholders: ['{{posts}}'],
    default_provider: 'openai',
    fallback: `You are identifying duplicate stories for a NEWSLETTER. Your goal is to prevent readers from seeing multiple articles about the SAME STORY or EVENT.

CRITICAL DEDUPLICATION RULES:
1. **SAME STORY = DUPLICATE**: Articles covering the SAME news story from different sources are DUPLICATES
   - Example: "OpenAI Restructures, Unlocks Capital" + "OpenAI Restructures, Eases Capital Constraints" → DUPLICATES (same OpenAI $500B restructure story)

2. **SHARED KEY FACTS = DUPLICATE**: If articles share 3+ key facts (companies, people, amounts, events), they are DUPLICATES
   - Example: Both mention "OpenAI", "$500 billion", "Microsoft 27%", "Sam Altman" → DUPLICATES

3. **SAME TYPE OF EVENT = DUPLICATE**: Multiple similar events (fire dept open houses, school meetings, business openings)

4. **BE AGGRESSIVE**: When in doubt, mark as duplicates. Better to show fewer unique stories than repeat the same story.

5. **USE FULL ARTICLE TEXT**: Read the full text to identify shared facts, not just titles

6. **KEEP BEST VERSION**: For each group, keep the article with the MOST SPECIFIC details (names, dates, locations, quotes)

EXAMPLES OF DUPLICATES:
- "OpenAI valued at $500B" + "OpenAI restructures with Microsoft stake" → DUPLICATES (same company restructure story)
- "Company announces layoffs" + "Employees let go at Company" → DUPLICATES (same layoff event)
- "Sartell Fire Dept Open House Oct 12" + "St. Cloud Fire Station Open House Oct 12" → DUPLICATES (same type of event)
- "School board meeting tonight" + "Board to discuss budget tonight" → DUPLICATES (same event)

Articles to analyze (array indices are 0-based - first article is index 0):
{{posts}}

IMPORTANT: Use 0-based indexing (first article = 0, second = 1, etc.)

Respond with valid JSON in this exact format:
{
  "groups": [
    {
      "topic_signature": "<brief topic description>",
      "primary_article_index": <number (0-based)>,
      "duplicate_indices": [<array of numbers (0-based)>],
      "similarity_explanation": "<why these are duplicates>"
    }
  ],
  "unique_articles": [<array of article indices that are unique (0-based)>]
}`
  },
  {
    key: 'ai_prompt_primary_article_title',
    description: 'Generates headline for primary section articles',
    placeholders: ['{{title}}', '{{description}}', '{{content}}', '{{url}}'],
    default_provider: 'openai',
    fallback: `Create an engaging, original headline for this article.

Original Title: {{title}}
Description: {{description}}
Content: {{content}}
Source URL: {{url}}

REQUIREMENTS:
- Completely new headline (not modified original)
- Use powerful verbs and emotional adjectives
- NO colons (:) in headlines
- NO emojis, hashtags (#), or URLs
- 8-12 words maximum

Respond with valid JSON:
{
  "headline": "<your engaging headline>"
}`
  },
  {
    key: 'ai_prompt_primary_article_body',
    description: 'Generates body text for primary section articles',
    placeholders: ['{{title}}', '{{description}}', '{{content}}', '{{url}}', '{{headline}}'],
    default_provider: 'openai',
    fallback: `Write a concise newsletter article based on this source post.

Original Title: {{title}}
Description: {{description}}
Content: {{content}}
Source URL: {{url}}
Headline: {{headline}}

REQUIREMENTS:
- Length: EXACTLY 40-75 words
- One concise paragraph only
- Completely rewrite content (similar phrasing OK, no exact copying)
- Use ONLY information from source post
- NO emojis, hashtags (#), URLs, or "today/tomorrow/yesterday"
- Third-party perspective (no "we/our/us" unless community-wide)

Respond with valid JSON:
{
  "content": "<40-75 word article>",
  "word_count": <exact word count>
}`
  },
  {
    key: 'ai_prompt_secondary_article_title',
    description: 'Generates headline for secondary section articles',
    placeholders: ['{{title}}', '{{description}}', '{{content}}', '{{url}}'],
    default_provider: 'openai',
    fallback: `Create an engaging, original headline for this article.

Original Title: {{title}}
Description: {{description}}
Content: {{content}}
Source URL: {{url}}

REQUIREMENTS:
- Completely new headline (not modified original)
- Use powerful verbs and emotional adjectives
- NO colons (:) in headlines
- NO emojis, hashtags (#), or URLs
- 8-12 words maximum

Respond with valid JSON:
{
  "headline": "<your engaging headline>"
}`
  },
  {
    key: 'ai_prompt_secondary_article_body',
    description: 'Generates body text for secondary section articles',
    placeholders: ['{{title}}', '{{description}}', '{{content}}', '{{url}}', '{{headline}}'],
    default_provider: 'openai',
    fallback: `Write a concise newsletter article based on this source post.

Original Title: {{title}}
Description: {{description}}
Content: {{content}}
Source URL: {{url}}
Headline: {{headline}}

REQUIREMENTS:
- Length: EXACTLY 40-75 words
- One concise paragraph only
- Completely rewrite content (similar phrasing OK, no exact copying)
- Use ONLY information from source post
- NO emojis, hashtags (#), URLs, or "today/tomorrow/yesterday"
- Third-party perspective (no "we/our/us" unless community-wide)

Respond with valid JSON:
{
  "content": "<40-75 word article>",
  "word_count": <exact word count>
}`
  },
  {
    key: 'ai_prompt_subject_line',
    description: 'Generates email subject line from top article',
    placeholders: ['{{headline}}', '{{content}}'],
    default_provider: 'claude',
    fallback: `Craft a front-page newspaper headline for the next-day edition based on the top-ranked article.

Article Headline: {{headline}}
Article Content: {{content}}

REQUIREMENTS:
- Focus on clarity and accuracy
- Use active voice
- Keep it punchy and newsworthy
- NO character limit
- NO emojis

Respond with valid JSON:
{
  "subject_line": "<your subject line>"
}`
  },
  {
    key: 'ai_prompt_welcome_section',
    description: 'Generates welcome text for newsletter',
    placeholders: ['{{articles}}'],
    default_provider: 'openai',
    fallback: `Write a warm, engaging welcome paragraph for today's newsletter.

Top Articles:
{{articles}}

REQUIREMENTS:
- 40-60 words
- Friendly, conversational tone
- Briefly tease 2-3 top stories
- End with "Let's dive in!" or similar
- NO emojis

Respond with valid JSON:
{
  "welcome_text": "<your welcome paragraph>"
}`
  },
  {
    key: 'ai_prompt_fact_checker',
    description: 'Validates newsletter article against source content',
    placeholders: ['{{newsletter_content}}', '{{original_content}}'],
    default_provider: 'openai',
    fallback: `CRITICAL FACT-CHECK: Verify this newsletter article follows strict content rules and contains no violations.

Newsletter Article:
{{newsletter_content}}

Original Source Content:
{{original_content}}

CHECK FOR VIOLATIONS:
1. Added information not in source
2. Exact copying of phrases
3. Emojis, hashtags (#), or URLs
4. "Today/tomorrow/yesterday" references
5. Editorial commentary or opinions
6. First-person perspective ("we/our/us" unless community-wide)

Respond with valid JSON:
{
  "passes": <boolean>,
  "violations": [<array of violation descriptions>],
  "explanation": "<detailed explanation>"
}`
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true

  try {
    console.log('[MIGRATE] Starting AI prompts migration...')
    console.log(`[MIGRATE] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

    // Check which prompts exist
    const { data: existingPrompts, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, ai_provider')
      .in('key', REQUIRED_PROMPTS.map(p => p.key))

    if (fetchError) {
      console.error('[MIGRATE] Error fetching existing prompts:', fetchError)
      throw fetchError
    }

    const existingKeys = new Set(existingPrompts?.map(p => p.key) || [])
    const missingPrompts = REQUIRED_PROMPTS.filter(p => !existingKeys.has(p.key))
    const existingPromptsData = REQUIRED_PROMPTS.filter(p => existingKeys.has(p.key))

    console.log(`[MIGRATE] Found ${existingKeys.size} existing prompts`)
    console.log(`[MIGRATE] Found ${missingPrompts.length} missing prompts`)

    const results = {
      dry_run: dryRun,
      total_required: REQUIRED_PROMPTS.length,
      existing: existingPromptsData.map(p => ({
        key: p.key,
        description: p.description,
        current_provider: existingPrompts?.find(ep => ep.key === p.key)?.ai_provider || 'unknown'
      })),
      missing: missingPrompts.map(p => ({
        key: p.key,
        description: p.description,
        placeholders: p.placeholders,
        default_provider: p.default_provider
      })),
      inserted: [] as Array<{ key: string; description: string }>
    }

    // If not dry run, insert missing prompts
    if (!dryRun && missingPrompts.length > 0) {
      console.log(`[MIGRATE] Inserting ${missingPrompts.length} missing prompts...`)

      for (const prompt of missingPrompts) {
        const { error: insertError } = await supabaseAdmin
          .from('app_settings')
          .insert([{
            key: prompt.key,
            value: prompt.fallback,
            ai_provider: prompt.default_provider
          }])

        if (insertError) {
          console.error(`[MIGRATE] Error inserting ${prompt.key}:`, insertError)
        } else {
          console.log(`[MIGRATE] ✓ Inserted ${prompt.key}`)
          results.inserted.push({
            key: prompt.key,
            description: prompt.description
          })
        }
      }
    }

    const summary = {
      status: 'success',
      message: dryRun
        ? `DRY RUN: Found ${missingPrompts.length} prompts that would be inserted`
        : `Inserted ${results.inserted.length} missing prompts`,
      ...results
    }

    return NextResponse.json(summary)

  } catch (error) {
    console.error('[MIGRATE] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
