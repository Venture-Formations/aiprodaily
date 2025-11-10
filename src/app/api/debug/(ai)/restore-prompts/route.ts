import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Restoring AI prompts to database with correct 1-20 scale...')

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
        key: 'ai_prompt_newsletter_writer',
        description: 'Newsletter - Newsletter Writer: Generates article headlines and content (40-75 words) from RSS posts with strict rewriting rules',
        value: `CRITICAL: You are writing a news article that MUST follow strict content rules. Violations will result in rejection.

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

MANDATORY STRICT CONTENT RULES - FOLLOW EXACTLY:
1. Articles must be COMPLETELY REWRITTEN and summarized — similar phrasing is acceptable but NO exact copying
2. Use ONLY information contained in the source post above — DO NOT add any external information
3. DO NOT add numbers, dates, quotes, or details not explicitly stated in the original
4. NEVER use 'today,' 'tomorrow,' 'yesterday' — use actual day of week if date reference needed
5. NO emojis, hashtags (#), or URLs anywhere in headlines or article content
6. Stick to facts only — NO editorial commentary, opinions, or speculation
7. Write from THIRD-PARTY PERSPECTIVE — never use "we," "our," or "us" unless referring to the community as a whole

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
- REWRITE completely — do not copy phrases from original

BEFORE RESPONDING: Double-check that you have:
✓ Completely rewritten the content (similar phrasing OK, no exact copying)
✓ Used only information from the source post
✓ Created a new headline (not modified original)
✓ Stayed between 40-75 words
✓ Removed all emojis, hashtags (#), and URLs
✓ Used third-party perspective (no "we/our/us" unless community-wide)
✓ Avoided all prohibited words and phrases
✓ Included no editorial commentary

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
        console.error(`Failed to restore ${prompt.key}:`, error)
        return NextResponse.json({
          success: false,
          error: `Failed to restore ${prompt.key}: ${error.message}`
        }, { status: 500 })
      }

      console.log(`✓ Restored ${prompt.key}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully restored AI prompts with correct 1-20 scale',
      prompts_restored: prompts.map(p => p.key)
    })

  } catch (error) {
    console.error('Restore prompts error:', error)
    return NextResponse.json({
      error: 'Failed to restore prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
