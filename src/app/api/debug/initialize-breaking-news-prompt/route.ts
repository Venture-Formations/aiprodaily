import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Initialize Breaking News Scorer AI Prompt in database
 * GET /api/debug/initialize-breaking-news-prompt
 */
export async function GET() {
  try {
    console.log('Initializing Breaking News Scorer AI Prompt...')

    const breakingNewsScorerPrompt = `You are evaluating a news article for inclusion in the AI Accounting Professionals newsletter's "Breaking News" section.

Your task is to score this article's RELEVANCE and IMPORTANCE to accounting professionals on a scale of 0-100.

SCORING CRITERIA (0-100 scale):

HIGH SCORES (70-100):
- Breaking regulatory changes (IRS, FASB, SEC, PCAOB)
- Major tax law updates or court rulings affecting accounting
- Significant AI tool launches specifically for accounting/tax
- Major firm acquisitions, leadership changes at Big 4 or Top 100 firms
- Critical cybersecurity threats targeting accounting firms
- Industry-wide adoption of new technologies or standards
- Major accounting scandals or enforcement actions
- Urgent compliance deadline changes

MEDIUM SCORES (40-69):
- General accounting industry news and trends
- New features in existing accounting software
- Regional accounting firm news with broader implications
- Educational content about accounting best practices
- Tax planning strategies and tips
- Minor regulatory updates
- Professional development opportunities
- Industry conference announcements

LOW SCORES (0-39):
- Generic business news without accounting angle
- Individual CPA certifications or promotions (unless major leadership)
- Marketing/promotional content for services
- Opinion pieces without newsworthy information
- Content focused on other industries
- Outdated news (over 1 week old)
- Repetitive topics recently covered

QUALITY FACTORS (add/subtract up to 10 points):
+5: Article includes specific actionable information
+5: Time-sensitive information that professionals need now
+3: Includes expert quotes or authoritative sources
-5: Vague or lacks specific details
-5: Primarily promotional content
-10: Misleading headline or clickbait

RELEVANCE TO ACCOUNTANTS (must score 30+ to be considered):
- Does this directly impact how accountants do their work?
- Would an accounting professional need to know this?
- Is this timely and actionable for the accounting industry?

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-100>,
  "category": "<breaking|beyond_feed>",
  "reasoning": "<detailed explanation of your scoring and why this is/isn't relevant to accounting professionals>",
  "key_topics": ["<topic1>", "<topic2>", "<topic3>"],
  "urgency": "<high|medium|low>",
  "actionable": <true|false>
}`

    // Upsert the prompt
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key: 'ai_prompt_breaking_news_scorer',
        value: breakingNewsScorerPrompt,
        description: 'Breaking News - Breaking News Scorer: Scores articles for relevance to accounting professionals (0-100 scale)',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      console.error('Error initializing Breaking News Scorer prompt:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Breaking News Scorer prompt initialized successfully',
      prompt_key: 'ai_prompt_breaking_news_scorer'
    })

  } catch (error) {
    console.error('Failed to initialize Breaking News Scorer prompt:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
