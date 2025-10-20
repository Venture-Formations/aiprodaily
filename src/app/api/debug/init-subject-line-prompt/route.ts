import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if subject line prompt already exists
    const { data: existing } = await supabaseAdmin
      .from('app_settings')
      .select('key')
      .eq('key', 'ai_prompt_subject_line')
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Subject line prompt already exists',
        action: 'none'
      })
    }

    // Create the subject line prompt with {{articles}} placeholder
    const template = `Craft a front-page newspaper headline for the next-day edition based on the most interesting article.

Articles in this newsletter:
{{articles}}

HARD RULES:
- ≤ 40 characters (count every space and punctuation) - this allows room for ice cream emoji prefix
- Title Case; avoid ALL-CAPS words
- Omit the year
- No em dashes (—)
- No colons (:) or other punctuation that splits the headline into two parts
- Return only the headline text—nothing else (no emoji, that will be added automatically)

IMPACT CHECKLIST:
- Lead with a power verb
- Local pride—include place name if it adds punch
- Trim fluff—every word earns its spot
- Character audit—recount after final trim

STYLE GUIDANCE: Write the headline as if the event just happened, not as a historical reflection or anniversary. Avoid words like 'Legacy,' 'Honors,' 'Remembers,' or 'Celebrates History.' Use an urgent, active voice suitable for a breaking news front page.

CREATIVITY REQUIREMENT: Each generation should produce a unique headline variation. Explore different angles, power verbs, and emotional hooks. Consider multiple ways to frame the same story - focus on different aspects, beneficiaries, or impacts. Never repeat previous generations.

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`

    const { error } = await supabaseAdmin
      .from('app_settings')
      .insert({
        key: 'ai_prompt_subject_line',
        value: template,
        description: 'AI prompt for generating newsletter subject lines (use {{articles}} placeholder)'
      })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Subject line prompt initialized successfully',
      action: 'created'
    })

  } catch (error: any) {
    console.error('Error initializing subject line prompt:', error)
    return NextResponse.json({
      error: 'Failed to initialize subject line prompt',
      details: error.message
    }, { status: 500 })
  }
}
