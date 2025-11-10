import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CRITERIA_PROMPTS = [
  {
    key: 'ai_prompt_criteria_1',
    name: 'Interest Level',
    weight: 1.5,
    value: `You are evaluating a newsletter article for INTEREST LEVEL to accounting professionals.

Your task is to score this article on a scale of 0-10 based on how interesting and engaging it is.

SCORING CRITERIA (0-10 scale):

HIGH SCORES (8-10):
- Unexpected developments or surprising insights
- Human interest stories with broad appeal
- Breaking news that will impact daily work
- Unique events or innovative solutions
- Fun, entertaining, or inspiring content
- Content that sparks conversation or curiosity

MEDIUM SCORES (4-7):
- Standard industry news
- Useful but routine updates
- Educational content with moderate appeal
- Business updates with some interest
- Typical professional development topics

LOW SCORES (0-3):
- Dry technical content
- Routine announcements with minimal appeal
- Purely administrative or procedural content
- Overly promotional material
- Repetitive topics recently covered
- Very niche content with limited broader interest

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,
    description: 'Evaluates how interesting and engaging the article is to readers (weight: 1.5)'
  },
  {
    key: 'ai_prompt_criteria_2',
    name: 'Professional Relevance',
    weight: 1.5,
    value: `You are evaluating a newsletter article for PROFESSIONAL RELEVANCE to accounting professionals.

Your task is to score this article on a scale of 0-10 based on how directly relevant it is to accounting practice.

SCORING CRITERIA (0-10 scale):

HIGH SCORES (8-10):
- Regulatory changes (IRS, FASB, SEC, PCAOB)
- Tax law updates or compliance requirements
- Accounting standards or practice guidelines
- Firm management best practices
- Technology specifically for accounting/tax work
- Industry trends affecting accounting profession
- Professional ethics or liability issues

MEDIUM SCORES (4-7):
- General business topics with accounting relevance
- Software tools used by accountants
- Professional development opportunities
- Economic trends affecting clients
- Client service strategies
- Marketing for accounting firms
- Leadership and management topics

LOW SCORES (0-3):
- Generic business content without accounting angle
- Topics unrelated to accounting practice
- Content for other industries
- Personal interest stories without professional connection
- Overly broad topics with minimal accounting relevance

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,
    description: 'Evaluates how directly relevant the article is to accounting practice (weight: 1.5)'
  },
  {
    key: 'ai_prompt_criteria_3',
    name: 'Profession Impact',
    weight: 1.0,
    value: `You are evaluating a newsletter article for PROFESSION IMPACT on accounting professionals.

Your task is to score this article on a scale of 0-10 based on how much it affects accountants' daily work or professional lives.

SCORING CRITERIA (0-10 scale):

HIGH SCORES (8-10):
- Urgent compliance deadline changes
- Critical regulatory updates requiring immediate action
- Significant technology disruptions or security threats
- Major industry-wide policy changes
- Time-sensitive information professionals must act on
- Changes affecting how accountants do core work
- New requirements or standards to implement

MEDIUM SCORES (4-7):
- Helpful tips that improve efficiency
- New tools or features that enhance productivity
- Industry trends to be aware of
- Best practices worth considering
- Educational content for skill development
- Networking or career development opportunities
- Firm management improvements

LOW SCORES (0-3):
- Nice-to-know information without actionable impact
- Individual achievements or announcements
- Content with no clear application to daily work
- Opinion pieces without concrete implications
- Historical context without current relevance
- Promotional content for products/services

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,
    description: 'Evaluates how much the article affects daily work or professional lives (weight: 1.0)'
  },
  {
    key: 'ai_prompt_criteria_4',
    name: 'Criteria 4',
    weight: 1.0,
    value: `You are evaluating a newsletter article for Criteria 4.

Score this article on a scale of 0-10.

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,
    description: 'Placeholder criteria 4 (currently disabled, weight: 1.0)'
  },
  {
    key: 'ai_prompt_criteria_5',
    name: 'Criteria 5',
    weight: 1.0,
    value: `You are evaluating a newsletter article for Criteria 5.

Score this article on a scale of 0-10.

Article Title: {{title}}
Article Description: {{description}}
Article Content: {{content}}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,
    description: 'Placeholder criteria 5 (currently disabled, weight: 1.0)'
  },
  {
    key: 'ai_prompt_article_writer',
    name: 'Article Writer',
    weight: null,
    value: `CRITICAL: You are writing a newsletter article for accounting professionals that MUST follow strict content rules.

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

HEADLINE REQUIREMENTS:
- Create completely new, engaging headline (not modified original)
- Use powerful verbs and emotional adjectives
- NO colons (:) or emojis

ARTICLE REQUIREMENTS:
- Length: EXACTLY 75-150 words
- Structure: 1-2 concise paragraphs
- Style: Professional, informative, engaging
- REWRITE completely - do not copy phrases

Response format:
{
  "headline": "<completely new engaging headline>",
  "content": "<75-150 word rewritten article>",
  "word_count": <exact word count>
}`,
    description: 'Generates newsletter-ready article content from RSS posts'
  },
  {
    key: 'ai_prompt_fact_checker',
    name: 'Fact Checker',
    weight: null,
    value: `CRITICAL FACT-CHECK: Verify this newsletter article follows strict content rules.

Newsletter Article:
{{newsletter_content}}

Original Source:
{{original_content}}

CHECK FOR VIOLATIONS:
1. EXACT COPIED TEXT: Word-for-word copying (similar phrasing OK)
2. ADDED INFORMATION: Facts not in original source
3. PROHIBITED WORDS: 'today,' 'tomorrow,' 'yesterday'
4. FORMATTING: Emojis, hashtags (#), URLs
5. PERSPECTIVE: Inappropriate "we/our/us"
6. EDITORIAL: Opinions or speculation
7. MODIFIED TITLE: Just reworded original

SCORING (each 1-10):
- Accuracy: Content matches source, no additions
- Compliance: Follows all formatting/style rules
- Quality: Professional, engaging, well-written

Total Score = accuracy + compliance + quality (3-30)
PASSING: 20/30 minimum

Response format:
{
  "accuracy_score": <1-10>,
  "compliance_score": <1-10>,
  "quality_score": <1-10>,
  "total_score": <3-30>,
  "violations": "<detailed list or 'none'>",
  "passed": <boolean true if >= 20>
}`,
    description: 'Validates article content for accuracy and compliance'
  }
]

export async function GET() {
  try {
    console.log('Initializing criteria scoring AI prompts...')

    const results = []

    for (const prompt of CRITERIA_PROMPTS) {
      // Check if prompt already exists
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', prompt.key)
        .single()

      if (existing) {
        console.log(`Prompt ${prompt.key} already exists, updating...`)
        const { data, error } = await supabaseAdmin
          .from('app_settings')
          .update({
            value: prompt.value,
            description: prompt.description,
            updated_at: new Date().toISOString()
          })
          .eq('key', prompt.key)
          .select()
          .single()

        if (error) {
          console.error(`Error updating ${prompt.key}:`, error)
          results.push({ key: prompt.key, status: 'error', error: error.message })
        } else {
          results.push({ key: prompt.key, status: 'updated', name: prompt.name })
        }
      } else {
        console.log(`Creating new prompt: ${prompt.key}`)
        const { data, error } = await supabaseAdmin
          .from('app_settings')
          .insert({
            key: prompt.key,
            value: prompt.value,
            description: prompt.description
          })
          .select()
          .single()

        if (error) {
          console.error(`Error creating ${prompt.key}:`, error)
          results.push({ key: prompt.key, status: 'error', error: error.message })
        } else {
          results.push({ key: prompt.key, status: 'created', name: prompt.name })
        }
      }

      // Also store the criteria name and weight in separate settings
      if (prompt.key.startsWith('ai_prompt_criteria_')) {
        const criteriaNumber = prompt.key.replace('ai_prompt_criteria_', '')

        // Store criteria name
        const nameKey = `criteria_${criteriaNumber}_name`
        await supabaseAdmin
          .from('app_settings')
          .upsert({
            key: nameKey,
            value: prompt.name,
            description: `Name for criteria ${criteriaNumber}`
          })

        // Store criteria weight
        if (prompt.weight !== null) {
          const weightKey = `criteria_${criteriaNumber}_weight`
          await supabaseAdmin
            .from('app_settings')
            .upsert({
              key: weightKey,
              value: prompt.weight.toString(),
              description: `Default weight for criteria ${criteriaNumber}`
            })
        }
      }
    }

    // Also set the number of enabled criteria
    await supabaseAdmin
      .from('app_settings')
      .upsert({
        key: 'criteria_enabled_count',
        value: '3',
        description: 'Number of criteria currently enabled (1-5)'
      })

    return NextResponse.json({
      success: true,
      message: 'Criteria scoring prompts initialized successfully',
      results,
      criteria_enabled: 3,
      default_weights: {
        criteria_1: 1.5,
        criteria_2: 1.5,
        criteria_3: 1.0
      }
    })

  } catch (error) {
    console.error('Error initializing criteria prompts:', error)
    return NextResponse.json(
      {
        error: 'Failed to initialize prompts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
