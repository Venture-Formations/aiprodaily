import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/split-article-prompts' },
  async () => {
    const results = {
      primary_title_created: false,
      primary_body_created: false,
      secondary_title_created: false,
      secondary_body_created: false,
      errors: [] as string[]
    }

    // Primary Article Title Prompt
    const primaryTitlePrompt = `Create an engaging, original headline for this article.

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

HEADLINE REQUIREMENTS - MUST FOLLOW:
- NEVER reuse or slightly reword the original title
- Create completely new, engaging headline
- Use powerful verbs and emotional adjectives
- NO colons (:) in headlines
- NO emojis, hashtags (#), or URLs
- Length: 6-12 words ideal
- Style: Active voice, compelling, news-worthy

BEFORE RESPONDING: Double-check that you have:
✓ Created a new headline (not modified original)
✓ Used powerful verbs and emotional adjectives
✓ Avoided all prohibited words and punctuation
✓ Removed all emojis, hashtags (#), and URLs

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`

    const { data: primaryTitleExists } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_primary_article_title')
      .single()

    if (!primaryTitleExists) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: 'ai_prompt_primary_article_title',
          value: primaryTitlePrompt,
          description: 'Primary Article Prompts - Article Title: Generates engaging headlines from RSS posts'
        })

      if (error) {
        results.errors.push(`Primary title: ${error.message}`)
      } else {
        results.primary_title_created = true
      }
    }

    // Primary Article Body Prompt
    const primaryBodyPrompt = `Write a concise newsletter article based on this source post.

Headline to use: {{headline}}

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

MANDATORY STRICT CONTENT RULES:
1. Articles must be COMPLETELY REWRITTEN and summarized — similar phrasing is acceptable but NO exact copying
2. Use ONLY information contained in the source post above — DO NOT add any external information
3. DO NOT add numbers, dates, quotes, or details not explicitly stated in the original
4. NEVER use 'today,' 'tomorrow,' 'yesterday' — use actual day of week if date reference needed
5. NO emojis, hashtags (#), or URLs anywhere in article content
6. Stick to facts only — NO editorial commentary, opinions, or speculation
7. Write from THIRD-PARTY PERSPECTIVE — never use "we," "our," or "us" unless referring to the community as a whole

ARTICLE REQUIREMENTS:
- Length: EXACTLY 40-75 words
- Structure: One concise paragraph only
- Style: Informative, engaging, locally relevant
- REWRITE completely — do not copy phrases from original

BEFORE RESPONDING: Double-check that you have:
✓ Completely rewritten the content (similar phrasing OK, no exact copying)
✓ Used only information from the source post
✓ Stayed between 40-75 words
✓ Removed all emojis, hashtags (#), and URLs
✓ Used third-party perspective (no "we/our/us" unless community-wide)
✓ Avoided all prohibited words and phrases
✓ Included no editorial commentary

Respond with valid JSON in this exact format:
{
  "content": "<40-75 word completely rewritten article>",
  "word_count": <exact word count>
}`

    const { data: primaryBodyExists } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_primary_article_body')
      .single()

    if (!primaryBodyExists) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: 'ai_prompt_primary_article_body',
          value: primaryBodyPrompt,
          description: 'Primary Article Prompts - Article Body: Generates newsletter article content (use {{headline}} placeholder)'
        })

      if (error) {
        results.errors.push(`Primary body: ${error.message}`)
      } else {
        results.primary_body_created = true
      }
    }

    // Secondary Article Title Prompt
    const secondaryTitlePrompt = `Create an engaging, original headline for this article.

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

HEADLINE REQUIREMENTS - MUST FOLLOW:
- NEVER reuse or slightly reword the original title
- Create completely new, engaging headline
- Use powerful verbs and emotional adjectives
- NO colons (:) in headlines
- NO emojis, hashtags (#), or URLs
- Length: 6-12 words ideal
- Style: Active voice, compelling, news-worthy

BEFORE RESPONDING: Double-check that you have:
✓ Created a new headline (not modified original)
✓ Used powerful verbs and emotional adjectives
✓ Avoided all prohibited words and punctuation
✓ Removed all emojis, hashtags (#), and URLs

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`

    const { data: secondaryTitleExists } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_secondary_article_title')
      .single()

    if (!secondaryTitleExists) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: 'ai_prompt_secondary_article_title',
          value: secondaryTitlePrompt,
          description: 'Secondary Article Prompts - Article Title: Generates engaging headlines from RSS posts'
        })

      if (error) {
        results.errors.push(`Secondary title: ${error.message}`)
      } else {
        results.secondary_title_created = true
      }
    }

    // Secondary Article Body Prompt
    const secondaryBodyPrompt = `Write a concise newsletter article based on this source post.

Headline to use: {{headline}}

Original Source Post:
Title: {{title}}
Description: {{description}}
Content: {{content}}

MANDATORY STRICT CONTENT RULES:
1. Articles must be COMPLETELY REWRITTEN and summarized
2. Use ONLY information from the source post - NO external information
3. DO NOT add numbers, dates, quotes, or details not in the original
4. NEVER use 'today,' 'tomorrow,' 'yesterday'
5. NO emojis, hashtags (#), or URLs
6. Facts only - NO editorial commentary or opinions
7. Write from THIRD-PARTY PERSPECTIVE

ARTICLE REQUIREMENTS:
- Length: EXACTLY 75-150 words
- Structure: 1-2 concise paragraphs
- Style: Professional, informative, engaging
- REWRITE completely - do not copy phrases

BEFORE RESPONDING: Double-check that you have:
✓ Completely rewritten the content (similar phrasing OK, no exact copying)
✓ Used only information from the source post
✓ Stayed between 75-150 words
✓ Removed all emojis, hashtags (#), and URLs
✓ Used third-party perspective (no "we/our/us" unless community-wide)
✓ Avoided all prohibited words and phrases
✓ Included no editorial commentary

Respond with valid JSON in this exact format:
{
  "content": "<75-150 word rewritten article>",
  "word_count": <exact word count>
}`

    const { data: secondaryBodyExists } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_secondary_article_body')
      .single()

    if (!secondaryBodyExists) {
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: 'ai_prompt_secondary_article_body',
          value: secondaryBodyPrompt,
          description: 'Secondary Article Prompts - Article Body: Generates newsletter article content (use {{headline}} placeholder)'
        })

      if (error) {
        results.errors.push(`Secondary body: ${error.message}`)
      } else {
        results.secondary_body_created = true
      }
    }

    const created = [
      results.primary_title_created && 'Primary Article Title',
      results.primary_body_created && 'Primary Article Body',
      results.secondary_title_created && 'Secondary Article Title',
      results.secondary_body_created && 'Secondary Article Body'
    ].filter(Boolean)

    return NextResponse.json({
      success: true,
      message: created.length > 0
        ? `Created ${created.length} prompts: ${created.join(', ')}`
        : 'All article prompts already exist',
      results,
      note: 'You can now customize these prompts in Settings > AI Prompts'
    })
  }
)
