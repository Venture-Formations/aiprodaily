import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600

/**
 * Update the topic deduper prompt with improved version
 *
 * Usage: GET /api/debug/update-topic-deduper?dry_run=true
 */

const IMPROVED_PROMPT = `You are identifying duplicate stories for a NEWSLETTER. Your goal is to prevent readers from seeing multiple articles about the SAME STORY or EVENT.

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry_run') !== 'false' // Default true

  try {
    console.log('[UPDATE-DEDUPER] Checking current prompt...')

    // Get current prompt
    const { data: currentPrompt, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, ai_provider')
      .eq('key', 'ai_prompt_topic_deduper')
      .single()

    if (fetchError || !currentPrompt) {
      return NextResponse.json({
        status: 'error',
        message: 'Topic deduper prompt not found in database'
      }, { status: 404 })
    }

    const currentLength = currentPrompt.value.length
    const newLength = IMPROVED_PROMPT.length

    const response = {
      status: 'success',
      dry_run: dryRun,
      current_prompt_length: currentLength,
      new_prompt_length: newLength,
      changes: {
        added_rules: [
          'SAME STORY = DUPLICATE with OpenAI example',
          'SHARED KEY FACTS = DUPLICATE (3+ shared facts)',
          'BE AGGRESSIVE instruction',
          'More tech news examples'
        ],
        improvements: [
          'More aggressive grouping',
          'Better instructions for same-story detection',
          'Explicit OpenAI restructure example',
          'Clearer duplicate criteria'
        ]
      },
      current_provider: currentPrompt.ai_provider || 'openai'
    }

    if (!dryRun) {
      console.log('[UPDATE-DEDUPER] Updating prompt...')

      const { error: updateError } = await supabaseAdmin
        .from('app_settings')
        .update({
          value: IMPROVED_PROMPT,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'ai_prompt_topic_deduper')

      if (updateError) {
        console.error('[UPDATE-DEDUPER] Error updating:', updateError)
        throw updateError
      }

      console.log('[UPDATE-DEDUPER] ✓ Prompt updated successfully')
      return NextResponse.json({
        ...response,
        message: 'Topic deduper prompt updated successfully'
      })
    }

    return NextResponse.json({
      ...response,
      message: 'DRY RUN: Would update topic deduper prompt with improved version'
    })

  } catch (error) {
    console.error('[UPDATE-DEDUPER] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
