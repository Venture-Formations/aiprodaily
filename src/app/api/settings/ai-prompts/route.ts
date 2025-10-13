import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

// GET - Fetch all AI prompts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: prompts, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .like('key', 'ai_prompt_%')
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    // Parse prompts into structured format
    const formattedPrompts = prompts?.map(p => {
      const description = p.description || ''
      const parts = description.split(' - ')
      const category = parts[0] || 'General'
      const nameAndDesc = parts.slice(1).join(' - ')
      const [name, ...descParts] = nameAndDesc.split(': ')

      return {
        key: p.key,
        category,
        name: name || p.key.replace('ai_prompt_', '').replace(/_/g, ' '),
        description: descParts.join(': ') || '',
        value: p.value
      }
    }) || []

    // Group by category
    const grouped = formattedPrompts.reduce((acc, prompt) => {
      if (!acc[prompt.category]) {
        acc[prompt.category] = []
      }
      acc[prompt.category].push(prompt)
      return acc
    }, {} as Record<string, typeof formattedPrompts>)

    return NextResponse.json({
      success: true,
      prompts: formattedPrompts,
      grouped
    })

  } catch (error) {
    console.error('Failed to fetch AI prompts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH - Update a specific AI prompt
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key, value } = body

    if (!key || !value) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      )
    }

    if (!key.startsWith('ai_prompt_')) {
      return NextResponse.json(
        { error: 'Invalid prompt key' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        value,
        updated_at: new Date().toISOString()
      })
      .eq('key', key)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Prompt updated successfully'
    })

  } catch (error) {
    console.error('Failed to update AI prompt:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST - Reset prompt to default value (custom default if exists, otherwise code default)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { key, action } = body

    if (!key || !key.startsWith('ai_prompt_')) {
      return NextResponse.json(
        { error: 'Invalid prompt key' },
        { status: 400 }
      )
    }

    // Handle "Save as Default" action
    if (action === 'save_as_default') {
      // Get current value
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (fetchError || !current) {
        return NextResponse.json(
          { error: 'Prompt not found' },
          { status: 404 }
        )
      }

      // Save current value as custom default
      const { error: updateError } = await supabaseAdmin
        .from('app_settings')
        .update({
          custom_default: current.value,
          updated_at: new Date().toISOString()
        })
        .eq('key', key)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Current prompt saved as your custom default'
      })
    }

    // Handle "Reset to Default" action
    // First check if there's a custom default
    const { data: settings, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('custom_default')
      .eq('key', key)
      .single()

    let defaultValue: string

    if (!fetchError && settings?.custom_default) {
      // Use custom default if available
      defaultValue = settings.custom_default
    } else {
      // Fall back to code default
      const defaultPrompts = await getDefaultPrompts()
      const defaultPrompt = defaultPrompts.find(p => p.key === key)

      if (!defaultPrompt) {
        return NextResponse.json(
          { error: 'Default prompt not found' },
          { status: 404 }
        )
      }

      defaultValue = defaultPrompt.value
    }

    // Update database with default value
    const { error: updateError } = await supabaseAdmin
      .from('app_settings')
      .update({
        value: defaultValue,
        updated_at: new Date().toISOString()
      })
      .eq('key', key)

    if (updateError) throw updateError

    const usedCustomDefault = settings?.custom_default ? true : false

    return NextResponse.json({
      success: true,
      message: usedCustomDefault
        ? 'Prompt reset to your custom default'
        : 'Prompt reset to original code default',
      used_custom_default: usedCustomDefault
    })

  } catch (error) {
    console.error('Failed to process AI prompt action:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to get default prompts
async function getDefaultPrompts() {
  return [
    {
      key: 'ai_prompt_content_evaluator',
      value: `You are evaluating a news article for inclusion in a local St. Cloud, Minnesota newsletter. Rate on three dimensions using a 1-10 scale:

INTEREST LEVEL (1-10): How intriguing, surprising, or engaging is this story?
HIGH SCORING: Unexpected developments, human interest stories, breaking news, unique events, broad appeal, fun/entertaining
LOW SCORING: Routine announcements, technical/administrative content, repetitive topics, purely promotional, very short content (subtract points for lack of substance)

LOCAL RELEVANCE (1-10): How directly relevant is this to St. Cloud area residents?
HIGH SCORING: Events/news in St. Cloud and surrounding areas (Waite Park, Sartell, Sauk Rapids, Cold Spring), Stearns County government decisions, local business changes, school district news, local infrastructure/development, community events
LOW SCORING: State/national news without local angle, events far from St. Cloud area, generic content not location-specific

COMMUNITY IMPACT (1-10): How much does this affect local residents' daily lives or community?
HIGH SCORING: New services or amenities, policy changes affecting residents, public safety information, economic development/job creation, community services and resources
LOW SCORING: Individual achievements with limited community effect, internal organizational matters, entertainment without broader impact

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

{
  "interest_level": <number 1-10>,
  "local_relevance": <number 1-10>,
  "community_impact": <number 1-10>,
  "reasoning": "<detailed explanation of your scoring>"
}`
    },
    {
      key: 'ai_prompt_newsletter_writer',
      value: `You are a local newsletter writer for St. Cloud, Minnesota. Transform this news article into a concise, engaging summary for tomorrow's newsletter.

WRITING STYLE:
- Natural, conversational tone (not overly formal or promotional)
- Active voice and present tense where appropriate
- Focus on facts and community impact
- 2-3 sentences maximum (40-60 words ideal)
- Front-load the most important information
- Avoid unnecessary adjectives or hype

CONTENT GUIDELINES:
- Lead with the most newsworthy element
- Include specific details (names, locations, dates, numbers)
- Explain "why this matters" to local residents
- Remove promotional language from original source
- Maintain factual accuracy - don't add information not in the source
- For events: Include day of week, time, and location if available

DO NOT:
- Add flowery language or excessive enthusiasm
- Include "you won't want to miss" or similar promotional phrases
- Start with "In exciting news" or similar phrases
- Add information not present in the original article
- Use phrases like "recently announced" or "coming soon" (be specific with dates when possible)

Source Article Title: {{title}}
Source Article Description: {{description}}
Source URL: {{url}}

Write a 2-3 sentence newsletter summary. Return ONLY the summary text, no additional formatting or explanation.`
    },
    {
      key: 'ai_prompt_subject_line',
      value: `You are writing a subject line for a local St. Cloud, Minnesota newsletter. Create a compelling subject line based on the top story.

REQUIREMENTS:
- Maximum 35 characters (strict limit - newsletter adds emoji prefix)
- Front-page newspaper headline style
- Breaking news voice (active, urgent, present tense)
- No colons, em dashes, or punctuation except essential periods/commas
- No year references (2024, 2025, etc.)
- No "today" or "tomorrow" references
- Must be unique each time (don't repeat previous subject lines)

STYLE GUIDELINES:
- Lead with strong action verbs
- Focus on the most newsworthy element
- Create curiosity without clickbait
- Use specific details (names, numbers, locations)
- Natural headline grammar (articles like "the/a" can be omitted)

GOOD EXAMPLES (≤35 chars):
- "St. Cloud Rallies To Block Leaves"
- "Wyndham Hotel Boosts Sartell Growth"
- "Youth Flock to Free Husky Hockey"

BAD EXAMPLES (avoid):
- "St. Cloud Gets Exciting News Today" (vague, uses "today")
- "Breaking: Major Development Coming" (clickbait, no specifics)
- "St. Cloud's 2025 Growth Plan Unveiled" (contains year)

Top Article Headline: {{headline}}
Top Article Summary: {{content}}

Generate ONE subject line. Return ONLY the subject line text (no quotes, no explanation).`
    },
    {
      key: 'ai_prompt_event_summary',
      value: `You are writing event descriptions for a St. Cloud, Minnesota community newsletter. Create a concise, inviting summary.

REQUIREMENTS:
- Approximately 50 words
- Natural, conversational tone
- Focus on what makes this event special or unique
- Include practical details if available (cost, registration, age groups)
- Welcoming and inclusive language

STYLE GUIDELINES:
- Start with the most compelling aspect
- Use active, engaging language
- Avoid generic phrases like "fun for the whole family"
- Be specific about activities or features
- Mention accessibility or special accommodations if relevant

Event Title: {{title}}
Event Description: {{description}}
Event Venue: {{venue}}

Write a 50-word event summary. Return ONLY the summary text.`
    },
    {
      key: 'ai_prompt_road_work',
      value: `You are a local newsletter writer collecting road construction and maintenance information for St. Cloud, Minnesota residents.

Generate 9 realistic road work items for the St. Cloud area (within 15 miles of ZIP 56303) that would be happening on {{date}}.

REQUIREMENTS:
- Each item must be a real, plausible road project
- Include mix of state highways, county roads, and city streets
- Vary the types of work (resurfacing, bridge repair, utility work, lane closures, detours)
- Include specific road names, ranges (e.g., "10th St between 5th Ave and 7th Ave")
- Cities/townships: St. Cloud, Waite Park, Sartell, Sauk Rapids, St. Joseph, Cold Spring, Richmond
- Realistic date ranges (some quick 1-2 day projects, some longer multi-week)
- All items should be active or planned for the target date

SOURCE URLs (use real MN DOT and county sites):
- https://www.dot.state.mn.us/roadwork/
- https://www.co.stearns.mn.us/Departments/PublicWorks
- https://www.stcloudmn.gov/directory/departments/public-services

Return ONLY a JSON array with 9 items:
[
  {
    "road_name": "Division Street",
    "road_range": "Between 10th Ave and 15th Ave",
    "reason": "Mill and overlay resurfacing",
    "city_or_township": "Waite Park",
    "start_date": "MM/DD/YYYY",
    "expected_reopen": "MM/DD/YYYY",
    "source_url": "https://www.dot.state.mn.us/roadwork/"
  }
]`
    },
    {
      key: 'ai_prompt_image_analyzer',
      value: `Analyze this image for a St. Cloud, Minnesota local newsletter. Focus on identifying elements relevant to community news, events, education, public safety, healthcare, sports, business development, seasonal activities, and local landmarks.

Return strict JSON:
{
  "caption": "...",
  "alt_text": "10–14 words, descriptive, no quotes",
  "tags_scored": [
    {"type":"scene","name":"warehouse","conf":0.95},
    {"type":"object","name":"golf_cart","conf":0.98},
    {"type":"color","name":"blue","conf":0.85},
    {"type":"mood","name":"professional","conf":0.78},
    {"type":"safety","name":"has_text","conf":0.12}
  ],
  "top_tags": ["scene_warehouse","object_golf_cart","color_blue","mood_professional"],
  "ocr_text": "extracted text in lowercase",
  "text_density": 0.15,
  "ocr_entities": [
    {"type":"ORG","name":"st cloud police department","conf":0.93},
    {"type":"DATE","name":"march 15","conf":0.87}
  ],
  "signage_conf": 0.78,
  "age_groups": [
    {"age_group":"adult","count":2,"conf":0.92},
    {"age_group":"high_school","count":1,"conf":0.87}
  ]
}

GUIDELINES:
- Caption: Natural, descriptive sentence about the image contents
- Alt text: 10-14 words maximum, accessible description for screen readers
- Tags scored: Array of categorized tags with confidence scores (0-1)
- Tag types: location, venue, scene, event_type, sport, season, object, safety, mood, activity
- Tag names: concrete nouns, lowercase with underscores
- Top tags: 5-15 most relevant tags in "type_name" format
- Include safety.has_text if text/signage is visible
- Confidence scores reflect certainty (0.9+ for obvious, 0.5-0.8 for likely, <0.5 for uncertain)
- Focus on concrete, visible elements rather than abstract concepts
- Mood tags: emotional atmosphere/feeling conveyed (happy, energetic, calm, serious, playful, etc.)

IMPORTANT: Only include OCR fields if readable text is actually present. Only include age_groups if people are visible and ages can be reasonably estimated. Set to null if not detected.`
    }
  ]
}
