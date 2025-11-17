import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Helper function to fetch prompt from database with code fallback
async function getPrompt(key: string, fallback: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) {
      console.warn(`⚠️  [AI-PROMPT] FALLBACK USED: ${key} (not found in database)`)
      console.warn(`⚠️  [AI-PROMPT] Run migration: GET /api/debug/migrate-ai-prompts?dry_run=false`)
      return fallback
    }

    return data.value
  } catch (error) {
    console.error(`❌ [AI-PROMPT] ERROR fetching ${key}, using fallback:`, error)
    return fallback
  }
}

// Helper function to fetch complete JSON API request from database
// Returns the prompt exactly as stored (complete JSON with model, messages, temperature, etc.)
async function getPromptJSON(key: string, newsletterId: string, fallbackText?: string): Promise<any> {
  try {
    // Try publication_settings first (with ai_provider column)
    const { data, error } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletterId)
      .eq('key', key)
      .single()

    if (error || !data) {
      // Fallback to app_settings with WARNING log
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (fallbackError || !fallbackData) {
        console.warn(`⚠️  [AI-PROMPT] FALLBACK USED: ${key} (not found in database)`)
        console.warn(`⚠️  [AI-PROMPT] Run migration: GET /api/debug/migrate-ai-prompts?dry_run=false`)

        if (!fallbackText) {
          throw new Error(`Prompt ${key} not found and no fallback provided`)
        }

        // Wrap fallback text in minimal JSON structure
        return {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: fallbackText }],
          _provider: 'openai'
        }
      }

      console.warn(`[SETTINGS FALLBACK] Using app_settings for key="${key}" (publication=${newsletterId}). Migrate this setting!`)
      // Use fallback data
      const valueToProcess = fallbackData.value
      let promptJSON: any
      if (typeof valueToProcess === 'string') {
        try {
          promptJSON = JSON.parse(valueToProcess)
        } catch (parseError) {
          throw new Error(`Prompt ${key} is not valid JSON. It must be structured JSON with a 'messages' array. Error: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
        }
      } else if (typeof valueToProcess === 'object' && valueToProcess !== null) {
        promptJSON = valueToProcess
      } else {
        throw new Error(`Prompt ${key} has invalid format. Expected structured JSON with a 'messages' array, got ${typeof valueToProcess}`)
      }

      if (!promptJSON.messages && !promptJSON.input) {
        throw new Error(`Prompt ${key} is missing 'messages' or 'input' array.`)
      }
      if (promptJSON.input && !promptJSON.messages) {
        promptJSON.messages = promptJSON.input
      }
      promptJSON._provider = 'openai'
      return promptJSON
    }

    // Parse value - must be valid structured JSON
    let promptJSON: any
    if (typeof data.value === 'string') {
      try {
        promptJSON = JSON.parse(data.value)
      } catch (parseError) {
        // Not JSON - this is an error, prompt must be structured
        throw new Error(`Prompt ${key} is not valid JSON. It must be structured JSON with a 'messages' array. Error: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
      }
    } else if (typeof data.value === 'object' && data.value !== null) {
      // Already an object (JSONB was auto-parsed)
      promptJSON = data.value
    } else {
      // Unknown format - this is an error
      throw new Error(`Prompt ${key} has invalid format. Expected structured JSON with a 'messages' array, got ${typeof data.value}`)
    }

    // Validate structure - must have messages OR input array (OpenAI Responses API uses 'input', we normalize to 'messages')
    // Check for both 'messages' (standard format) and 'input' (OpenAI Responses API format)
    if (!promptJSON.messages && !promptJSON.input) {
      throw new Error(`Prompt ${key} is missing 'messages' or 'input' array. It must be structured JSON like: { "model": "...", "messages": [...] } or { "model": "...", "input": [...] }`)
    }

    if (promptJSON.messages && !Array.isArray(promptJSON.messages)) {
      throw new Error(`Prompt ${key} has 'messages' but it's not an array. It must be an array of message objects.`)
    }

    if (promptJSON.input && !Array.isArray(promptJSON.input)) {
      throw new Error(`Prompt ${key} has 'input' but it's not an array. It must be an array of message objects.`)
    }

    // Normalize: If it has 'input' but not 'messages', convert 'input' to 'messages' for internal use
    // This allows database to store either format (Settings saves with 'input', but we use 'messages' internally)
    if (promptJSON.input && !promptJSON.messages) {
      promptJSON.messages = promptJSON.input
      // Don't delete 'input' - keep it so it can be used directly if needed
    }

    // Auto-detect provider from model name
    const modelName = (promptJSON.model || '').toLowerCase()
    if (modelName.includes('claude') || modelName.includes('sonnet') || modelName.includes('opus') || modelName.includes('haiku')) {
      promptJSON._provider = 'claude'
      console.log(`[AI] Auto-detected Claude provider from model: ${promptJSON.model}`)
    } else {
      promptJSON._provider = 'openai'
    }

    return promptJSON
  } catch (error) {
    console.error(`❌ [AI-PROMPT] ERROR fetching ${key}:`, error)

    if (!fallbackText) {
      throw error
    }

    // Return fallback wrapped in minimal JSON
    return {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: fallbackText }],
      _provider: 'openai'
    }
  }
}

// Legacy function - DEPRECATED, use getPromptJSON instead
async function getPromptWithProvider(key: string, fallback: string): Promise<{ prompt: string; provider: 'openai' | 'claude' }> {
  console.warn(`⚠️  [DEPRECATED] getPromptWithProvider() is deprecated. Use getPromptJSON() instead for ${key}`)
  try {
    const promptJSON = await getPromptJSON(key, fallback)
    const provider = promptJSON._provider || 'openai'

    // Return just the content from first user message for backward compat
    let promptText = fallback
    if (promptJSON.messages && promptJSON.messages.length > 0) {
      const userMsg = promptJSON.messages.find((m: any) => m.role === 'user')
      promptText = userMsg?.content || fallback
    }

    return { prompt: promptText, provider }
  } catch (error) {
    return { prompt: fallback, provider: 'openai' }
  }
}

// AI Prompts - Static fallbacks when database is unavailable
const FALLBACK_PROMPTS = {
  contentEvaluator: (post: { title: string; description: string; content?: string; hasImage?: boolean }) => `
You are evaluating a news article for inclusion in a local St. Cloud, Minnesota newsletter.

CRITICAL: You MUST use these exact scoring scales:
- interest_level: Integer between 1 and 20 (NOT 1-10, MUST BE 1-20)
- local_relevance: Integer between 1 and 10
- community_impact: Integer between 1 and 10

IMAGE PENALTY: ${post.hasImage ? 'This post HAS an image.' : 'This post has NO image - subtract 5 points from interest_level.'}

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

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.
The interest_level field MUST be between 1 and 20, NOT between 1 and 10.

Response format:
{
  "interest_level": <integer 1-20, use full range>,
  "local_relevance": <integer 1-10>,
  "community_impact": <integer 1-10>,
  "reasoning": "<detailed explanation of your scoring>"
}`,

  topicDeduper: (posts: Array<{ title: string; description: string; full_article_text: string }>) => `
You are identifying duplicate stories for a NEWSLETTER. Your goal is to prevent readers from seeing multiple articles about the SAME STORY or EVENT.

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
${posts.map((post, i) => `
${i}. Title: ${post.title}
   Description: ${post.description || 'No description'}
   Full Article: ${post.full_article_text ? post.full_article_text.substring(0, 1500) + (post.full_article_text.length > 1500 ? '...' : '') : 'No full text available'}
`).join('\n')}

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
}`,

  newsletterWriter: (post: { title: string; description: string; content?: string; source_url?: string }) => `
CRITICAL: You are writing a news article that MUST follow strict content rules. Violations will result in rejection.

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content || 'No additional content'}

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
}`,

  factChecker: (newsletterContent: string, originalContent: string) => `
CRITICAL FACT-CHECK: Verify this newsletter article follows strict content rules and contains no violations.

Newsletter Article:
${newsletterContent}

Original Source Material:
${originalContent.substring(0, 2000)}

STRICT CONTENT VIOLATIONS TO CHECK FOR:
1. EXACT COPIED TEXT: Direct word-for-word copying from source (similar phrasing is acceptable)
2. ADDED INFORMATION: Any facts, numbers, dates, quotes not in original source
3. PROHIBITED WORDS: Use of 'today,' 'tomorrow,' 'yesterday' instead of specific days
4. FORMATTING VIOLATIONS: Any emojis, hashtags (#), or URLs in headline or content
5. PERSPECTIVE VIOLATIONS: Use of "we," "our," "us" unless referring to community as whole
6. EDITORIAL CONTENT: Opinions, speculation, or commentary not in source
7. MODIFIED ORIGINAL TITLE: Headlines that are just slightly reworded versions of original

ACCURACY SCORING (1-10, where 10 = perfect compliance):
- Start at 10
- Subtract 3 points for excessive exact word-for-word copying (similar phrasing is OK)
- Subtract 4 points for ANY added information not in source
- Subtract 3 points for prohibited time words (today/tomorrow/yesterday)
- Subtract 2 points for ANY emojis, hashtags, or URLs found
- Subtract 2 points for inappropriate use of "we/our/us" perspective
- Subtract 3 points for editorial commentary or speculation
- Subtract 4 points if headline is just modified version of original title
- Minimum score: 1

TIMELINESS SCORING (1-10):
- Start at 10
- Subtract 5 points for outdated information presented as current
- Subtract 3 points for vague time references without context
- Subtract 2 points for missing temporal context when needed
- Minimum score: 1

INTENT ALIGNMENT SCORING (1-10):
- Start at 10
- Subtract 4 points for changing the source's main message
- Subtract 3 points for adding interpretation not in source
- Subtract 2 points for emphasis shifts from original
- Minimum score: 1

TOTAL SCORE = accuracy + timeliness + intent (3-30 range)
PASSING THRESHOLD: 15/30 minimum

Respond with valid JSON in this exact format:
{
  "score": <number 3-30>,
  "details": "<detailed list of all violations found or 'none'>",
  "passed": <boolean true if score >= 15, false otherwise>
}`,

  eventSummarizer: (event: { title: string; description: string | null; venue?: string | null }) => `
Rewrite the description field into a concise, natural-language highlight of 50 words or fewer. Do not copy or truncate the first words; paraphrase so it reads well.

Event Title: ${event.title}
Event Description: ${event.description || 'No description available'}
Event Venue: ${event.venue || 'No venue specified'}

REQUIREMENTS:
- Maximum 50 words
- Natural, engaging language
- Paraphrase completely - don't copy original wording
- Capture the essence and appeal of the event
- Write in third person
- Include key details that make it interesting

Respond with valid JSON in this exact format:
{
  "event_summary": "<concise 50-word summary>",
  "word_count": <exact word count>
}`,

  subjectLineGenerator: (top_article: { headline: string; content: string }) => `
Craft a front-page newspaper headline for the next-day edition based on the top-ranked article.

Top Article (Rank #1):
Headline: ${top_article.headline}
Content: ${top_article.content}

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

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`,

  welcomeSection: (articles: Array<{ headline: string; content: string }>) => {
    const articlesText = articles
      .map((article, index) => `${index + 1}. ${article.headline}\n   ${article.content.substring(0, 1000)}${article.content.length > 1000 ? '...' : ''}`)
      .join('\n\n')

    return `You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, Central Minnesota!"
- Include tagline: "Welcome back to your daily local news roundup."
- Weave in 3-5 key stories from today's newsletter in a flowing, natural sentence
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)

GUIDELINES:
- Use "Today, we've got..." or "Today, we're covering..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences

ARTICLES TO SUMMARIZE:
${articlesText}

Return ONLY the welcome text (no additional formatting or explanation).`
  },

  roadWorkGenerator: (issueDate: string) => `
Find CURRENT and ACTIVE road, lane, or bridge closures, detours, or traffic restrictions in effect on ${issueDate} within 10 miles of ZIP code 56303 (St. Cloud, MN metro area).

CRITICAL DATE REQUIREMENT:
- ONLY include projects that are ACTIVE on ${issueDate}
- Expected reopen date must be AFTER ${issueDate} (not completed yet)
- Start date must be ON OR BEFORE ${issueDate} (already begun)
- Do NOT include completed projects from summer 2025 or earlier
- MUST have CONFIRMED specific dates (e.g., "Oct 15", "Nov 30") - NO vague ranges like "Fall 2026" or "TBD"
- REJECT any items with unconfirmed or vague date ranges

SEARCH CRITERIA:
- Date: ${issueDate}
- Location: Within 10 miles of ZIP 56303 (St. Cloud, MN metro area)

INCLUDE ALL TYPES:
- Full closures, lane closures, bridge closures, detours, major traffic restrictions
- Current closures from all road types (state, county, city streets)
- Direction-specific lane closures (e.g., westbound/eastbound only)
- Segment-specific impacts within larger projects
- Construction impacts, travel advisories, traffic alerts, detour notices
- Bus route detours and public transit impacts
- Utility construction causing traffic restrictions
- Intermittent lane closures and periodic restrictions
- Water main work, pipeline work, road reconstruction
- Cold patching, resurfacing, maintenance work affecting traffic

EXPLICITLY INCLUDE:
- State highways: Hwy 55, Hwy 15, Hwy 10, Hwy 23
- County Roads in the area
- Closures in nearby cities: Sartell, Waite Park, St. Joseph, St. Augusta, Sauk Rapids
- Metro Bus route detours and schedule changes
- All types of construction projects (roundabouts, bridges, resurfacing)
- Projects that started before ${issueDate} but are still ongoing

STRICTLY EXCLUDE:
- Completed closures (reopen date before ${issueDate})
- Planned/future closures (start date after ${issueDate})
- Summer 2025 projects that ended in August or earlier
- Shoulder-only work with no traffic impact

REQUIRED SOURCES TO CHECK:
- https://www.dot.state.mn.us/d3/ (MnDOT District 3)
- https://www.stearnscountymn.gov/185/Public-Works
- https://www.co.benton.mn.us/180/Highway
- https://www.co.sherburne.mn.us/162/Public-Works
- https://www.ci.stcloud.mn.us (St. Cloud)
- https://www.cityofsartell.com/engineering/
- https://www.cityofstjoseph.com/
- https://www.ci.waitepark.mn.us/
- https://ci.sauk-rapids.mn.us/
- https://www.ridemetrobus.com (Metro Bus)
- Local media: WJON Traffic, St. Cloud Times Roads section
- 511mn.org (Minnesota road conditions)

TARGET: Find 6-9 different road work entries with CONFIRMED dates. Prioritize accuracy over volume - better to return fewer items with confirmed dates than more items with vague dates.

REQUIRED OUTPUT FORMAT:
Return ONLY a JSON array. Include as many real closures as found with confirmed dates (aim for 6-9 entries, but quality over quantity).

[
{"road_name":"[actual road name]","road_range":"from [start] to [end]","city_or_township":"[actual city]","reason":"[actual reason from source]","start_date":"[specific date like Oct 15]","expected_reopen":"[specific date like Nov 30]","source_url":"[actual URL where info was found]"}
]

CRITICAL REQUIREMENTS:
- Only return real, verified road work from actual government sources
- MUST have confirmed specific dates - NO "TBD", "Fall 2026", or vague ranges
- Better to return 3-4 items with confirmed dates than 9 items with vague dates
- Include minor impacts like lane restrictions, not just major closures
- Each item must be currently active on the target date`,

  imageAnalyzer: () => `
Analyze this image for a St. Cloud, Minnesota local newsletter. Focus on identifying elements relevant to community news, events, education, public safety, healthcare, sports, business development, seasonal activities, and local landmarks.

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

ST. CLOUD SPECIFIC TAGGING PRIORITIES:
Prioritize identifying and tagging these high-value categories for St. Cloud newsletter:

LOCATIONS & VENUES:
- Educational: apollo_high_school, scsu_campus, kennedy_school, talahi_school, college_of_saint_benedict
- Parks: lake_george, munsinger_gardens, clemens_gardens, quarry_park, wilson_park
- Downtown: downtown_st_cloud, jules_bistro, caribou_coffee, bad_habit_brewing
- Public Safety: fire_station, police_station, sartell_public_safety
- Healthcare: centracare_hospital, medical_facility, clinic
- Government: city_hall, county_building, district_office
- Sports Venues: herb_brooks_hockey_center, arena, gymnasium, athletic_field

EVENT TYPES:
- Community: ribbon_cutting, open_house, walkathon, festival, parade
- Sports: hockey_game, volleyball_match, soccer_game, basketball_game
- Education: school_spirit, graduation, classroom_activity
- Public Safety: fire_demonstration, police_k9, emergency_response
- Arts: theatre_performance, art_class, museum_exhibit
- Fundraising: charity_event, donation_activity, volunteer_work

SEASONAL MARKERS:
- Fall: autumn_foliage, pumpkins, halloween, harvest, golden_leaves
- Winter: snow, ice, hockey, winter_sports, holiday_lights
- Spring: flowers, gardens, blooming, renewal
- Summer: outdoor_events, lakes, recreation, sunshine

SPORTS & RECREATION:
- Hockey: husky_hockey, youth_hockey, ice_rink, hockey_equipment
- Other Sports: volleyball, soccer, basketball, athletics
- Recreation: walking_trails, bike_paths, playground, outdoor_activities

PUBLIC SAFETY & COMMUNITY:
- Fire: fire_truck, firefighter, fire_station_3, emergency_vehicle
- Police: police_cruiser, k9_unit, officer, patrol_vehicle
- Security: surveillance_camera, locked_door, safety_equipment
- Health: vaccination, medical_staff, hospital_equipment

BUSINESS & DEVELOPMENT:
- Construction: groundbreaking, road_work, building_construction, heavy_equipment
- Business: restaurant, retail, hotel, office_building
- Infrastructure: road_closed_sign, detour, traffic_control, maintenance

OCR ANALYSIS:
- ocr_text: Extract ALL readable text from the image, convert to lowercase, normalize spacing
- text_density: Estimate what percentage of the image area is covered by text (0.0 to 1.0)
- ocr_entities: Extract named entities from the OCR text using these types:
  * ORG: Organizations, businesses, government agencies (e.g., "st cloud state university", "centracare", "apollo high school")
  * PERSON: People's names
  * LOC: Locations, addresses, place names (e.g., "lake george", "downtown st cloud", "sartell")
  * DATE: Dates, times, temporal references
  * TIME: Specific times, hours
  * MISC: Other important entities (phone numbers, websites, street names)
- signage_conf: Confidence (0-1) that this is venue signage vs poster/advertisement
  * 0.8+ = Clear business signage, building signs
  * 0.5-0.8 = Likely signage but could be promotional
  * 0.2-0.5 = Probably poster/ad/document
  * <0.2 = Clearly not signage

AGE GROUP ANALYSIS:
- age_groups: Only include if people are clearly visible and identifiable
- Age categories: "preschool" (0-4), "elementary" (5-11), "high_school" (12-17), "adult" (18-64), "older_adult" (65+)
- count: Number of people in each age group
- conf: Confidence level (0-1) for age group classification
- Set to null if no people detected or ages cannot be determined

IMPORTANT: Only include OCR fields if readable text is actually present. Only include age_groups if people are visible and ages can be reasonably estimated. Set to null if not detected. Prioritize tags that match the St. Cloud newsletter's common article themes: education, public safety, community events, sports (especially hockey), seasonal activities, business development, and healthcare.`,

  roadWorkValidator: (roadWorkItems: Array<{
    road_name: string
    road_range: string | null
    city_or_township: string | null
    reason: string | null
    start_date: string | null
    expected_reopen: string | null
    source_url: string | null
  }>, targetDate: string) => `
You are validating road work data for accuracy and relevance. Review each item and determine if it should be included in the newsletter.

Target Date: ${targetDate}
Current Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}

Road Work Items to Validate:
${roadWorkItems.map((item, i) => `
${i + 1}. ${item.road_name}
   Range: ${item.road_range || 'Not specified'}
   Location: ${item.city_or_township || 'Not specified'}
   Reason: ${item.reason || 'Not specified'}
   Start: ${item.start_date || 'Not specified'}
   Expected Reopen: ${item.expected_reopen || 'Not specified'}
   Source: ${item.source_url || 'Not specified'}
`).join('\n')}

VALIDATION CRITERIA - Mark as INVALID if:
1. **Unconfirmed Dates**: Start date or expected reopen is "TBD", "To be determined", "Not specified", or similar vague language
2. **Already Completed**: Expected reopen date is before ${targetDate}
3. **Not Yet Started**: Start date is after ${targetDate}
4. **Vague Date Ranges**: Uses phrases like "Spring 2026", "Late Summer", "Fall", without specific month/day
5. **Old Projects**: Any indication the project is from a previous year that has already passed
6. **Missing Critical Info**: No road name, no location, or no reason specified
7. **Placeholder Content**: Generic entries like "No additional closures" or "TBD"

VALIDATION CRITERIA - Mark as VALID if:
1. **Confirmed Dates**: Has specific month/day format (e.g., "Oct 15", "Nov 30")
2. **Currently Active**: Start date is on or before ${targetDate} AND expected reopen is after ${targetDate}
3. **Real Project**: Has specific road name, location, reason, and source URL
4. **Verifiable**: Source URL points to government website (MnDOT, county, city)

For each item, provide:
- valid: true/false
- reason: Brief explanation of why it passed or failed validation
- confidence: 0-1 score (1.0 = certain, 0.5 = uncertain)

Respond with valid JSON in this exact format:
{
  "validated_items": [
    {
      "index": 0,
      "valid": true,
      "reason": "Has confirmed dates (Oct 15 - Nov 30) and is currently active",
      "confidence": 0.95
    }
  ],
  "summary": {
    "total_items": 9,
    "valid_items": 6,
    "invalid_items": 3,
    "accuracy_score": 0.67
  }
}`,

  // Multi-Criteria Scoring Prompts (customizable per criteria)
  criteria1Evaluator: (post: { title: string; description: string; content?: string }) => `
You are evaluating a newsletter article for INTEREST LEVEL to accounting professionals.

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

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,

  criteria2Evaluator: (post: { title: string; description: string; content?: string }) => `
You are evaluating a newsletter article for PROFESSIONAL RELEVANCE to accounting professionals.

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

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,

  criteria3Evaluator: (post: { title: string; description: string; content?: string }) => `
You are evaluating a newsletter article for PROFESSION IMPACT on accounting professionals.

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

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,

  criteria4Evaluator: (post: { title: string; description: string; content?: string }) => `
You are evaluating a newsletter article for Criteria 4.

Score this article on a scale of 0-10.

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,

  criteria5Evaluator: (post: { title: string; description: string; content?: string }) => `
You are evaluating a newsletter article for Criteria 5.

Score this article on a scale of 0-10.

Article Title: ${post.title}
Article Description: ${post.description || 'No description available'}
Article Content: ${post.content || 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.

Response format:
{
  "score": <integer 0-10>,
  "reason": "<detailed explanation of your scoring>"
}`,

  articleWriter: (post: { title: string; description: string; content?: string; source_url?: string }) => `
CRITICAL: You are writing a newsletter article for accounting professionals that MUST follow strict content rules.

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content || 'No additional content'}

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


  // Primary Article Title Generator
  primaryArticleTitle: (post: { title: string; description: string; content?: string }) => `
Create an engaging, original headline for this article.

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content ? post.content.substring(0, 1000) + '...' : 'No content available'}

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

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`,

  // Primary Article Body Generator
  primaryArticleBody: (post: { title: string; description: string; content?: string }, headline: string) => `
Write a concise newsletter article based on this source post.

Headline to use: ${headline}

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content || 'No additional content'}

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
}`,

  // Secondary Article Title Generator
  secondaryArticleTitle: (post: { title: string; description: string; content?: string }) => `
Create an engaging, original headline for this article.

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content ? post.content.substring(0, 1000) + '...' : 'No content available'}

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

Respond with ONLY the headline text - no JSON, no quotes, no extra formatting. Just the headline itself.`,

  // Secondary Article Body Generator
  secondaryArticleBody: (post: { title: string; description: string; content?: string }, headline: string) => `
Write a concise newsletter article based on this source post.

Headline to use: ${headline}

Original Source Post:
Title: ${post.title}
Description: ${post.description || 'No description available'}
Content: ${post.content || 'No additional content'}

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
}`,

  breakingNewsScorer: (article: { title: string; description: string; content?: string }) => `
You are evaluating a news article for inclusion in the AI Accounting Professionals newsletter's "Breaking News" section.

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
}

// Dynamic AI Prompts - Uses database with fallbacks (Oct 7 2025 - Force cache bust)
export const AI_PROMPTS = {
  contentEvaluator: async (post: { title: string; description: string; content?: string; hasImage?: boolean }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_content_evaluator')
        .single()

      if (error || !data) {
        console.log('Using code fallback for contentEvaluator prompt')
        return FALLBACK_PROMPTS.contentEvaluator(post)
      }

      // Database template uses {{}} placeholders
      const imagePenaltyText = post.hasImage
        ? 'This post HAS an image.'
        : 'This post has NO image - subtract 5 points from interest_level.'

      return data.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
        .replace(/\{\{imagePenalty\}\}/g, imagePenaltyText)
    } catch (error) {
      console.error('Error fetching contentEvaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.contentEvaluator(post)
    }
  },

  newsletterWriter: async (post: { title: string; description: string; content?: string; source_url?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_newsletter_writer')
        .single()

      if (error || !data) {
        console.log('Using code fallback for newsletterWriter prompt')
        return FALLBACK_PROMPTS.newsletterWriter(post)
      }

      return data.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1500) + '...' : 'No additional content')
        .replace(/\{\{url\}\}/g, post.source_url || '')
    } catch (error) {
      console.error('Error fetching newsletterWriter prompt, using fallback:', error)
      return FALLBACK_PROMPTS.newsletterWriter(post)
    }
  },

  eventSummarizer: async (event: { title: string; description: string | null; venue?: string | null }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_event_summary')
        .single()

      if (error || !data) {
        console.log('Using code fallback for eventSummarizer prompt')
        return FALLBACK_PROMPTS.eventSummarizer(event)
      }

      return data.value
        .replace(/\{\{title\}\}/g, event.title)
        .replace(/\{\{description\}\}/g, event.description || 'No description available')
        .replace(/\{\{venue\}\}/g, event.venue || 'No venue specified')
    } catch (error) {
      console.error('Error fetching eventSummarizer prompt, using fallback:', error)
      return FALLBACK_PROMPTS.eventSummarizer(event)
    }
  },

  subjectLineGenerator: async (top_article: { headline: string; content: string }) => {
    // subjectLineGenerator doesn't support database templates - always use fallback
    return FALLBACK_PROMPTS.subjectLineGenerator(top_article)
  },

  roadWorkGenerator: async (issueDate: string) => {
    // roadWorkGenerator doesn't support database templates - always use fallback
    return FALLBACK_PROMPTS.roadWorkGenerator(issueDate)
  },

  imageAnalyzer: async () => {
    return await getPrompt(
      'ai_prompt_image_analyzer',
      FALLBACK_PROMPTS.imageAnalyzer()
    )
  },

  topicDeduper: async (posts: Array<{ title: string; description: string; full_article_text: string }>) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value, ai_provider')
        .eq('key', 'ai_prompt_topic_deduper')
        .single()

      if (error || !data) {
        console.log('[AI] Using fallback for topicDeduper prompt')
        return FALLBACK_PROMPTS.topicDeduper(posts)
      }

      console.log('[AI] Using database prompt for topicDeduper')
      const provider = (data.ai_provider === 'claude' ? 'claude' : 'openai') as 'openai' | 'claude'

      // Format articles list for the prompt with full article text
      const articlesText = posts.map((post, i) => `
${i}. Title: ${post.title}
   Description: ${post.description || 'No description'}
   Full Article: ${post.full_article_text ? post.full_article_text.substring(0, 1500) + (post.full_article_text.length > 1500 ? '...' : '') : 'No full text available'}
`).join('\n')

      // Check if value is already an object (JSONB auto-parsed) or needs parsing
      let promptConfig: any
      if (typeof data.value === 'string') {
        // String value - try to parse as JSON
        try {
          promptConfig = JSON.parse(data.value)
        } catch (jsonError) {
          // Not JSON, treat as plain text prompt
          console.log('[AI] Using plain text prompt for topicDeduper')
          return data.value.replace(/\{\{articles\}\}/g, articlesText)
        }
      } else if (typeof data.value === 'object' && data.value !== null) {
        // Already an object (JSONB was auto-parsed)
        promptConfig = data.value
      } else {
        console.log('[AI] Unknown value format for topicDeduper, treating as plain text')
        return String(data.value).replace(/\{\{articles\}\}/g, articlesText)
      }

      // Check if it's a structured prompt
      if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
        console.log('[AI] Using structured JSON prompt for topicDeduper with provider:', provider)
        const placeholders = { articles: articlesText }
        return await callWithStructuredPrompt(promptConfig, placeholders, provider)
      }

      // Fallback to plain text
      console.log('[AI] Using plain text format for topicDeduper')
      const promptText = typeof promptConfig === 'string' ? promptConfig : JSON.stringify(promptConfig)
      return promptText.replace(/\{\{articles\}\}/g, articlesText)

    } catch (error) {
      console.error('[AI] Error loading topicDeduper prompt:', error)
      return FALLBACK_PROMPTS.topicDeduper(posts)
    }
  },
  factChecker: async (newsletterContent: string, originalContent: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value, ai_provider')
        .eq('key', 'ai_prompt_fact_checker')
        .single()

      if (error || !data) {
        console.log('[AI] Using fallback for factChecker prompt')
        return FALLBACK_PROMPTS.factChecker(newsletterContent, originalContent)
      }

      console.log('[AI] Using database prompt for factChecker')
      const provider = (data.ai_provider === 'claude' ? 'claude' : 'openai') as 'openai' | 'claude'

      // Check if value is already an object (JSONB auto-parsed) or needs parsing
      let promptConfig: any
      if (typeof data.value === 'string') {
        // String value - try to parse as JSON
        try {
          promptConfig = JSON.parse(data.value)
        } catch (jsonError) {
          // Not JSON, treat as plain text prompt
          console.log('[AI] Using plain text prompt for factChecker')
          return data.value
            .replace(/\{\{newsletterContent\}\}/g, newsletterContent)
            .replace(/\{\{newsletter_content\}\}/g, newsletterContent)
            .replace(/\{\{originalContent\}\}/g, originalContent.substring(0, 2000))
            .replace(/\{\{original_content\}\}/g, originalContent.substring(0, 2000))
        }
      } else if (typeof data.value === 'object' && data.value !== null) {
        // Already an object (JSONB was auto-parsed)
        promptConfig = data.value
      } else {
        // Unknown format, use as plain text
        console.log('[AI] Unknown value format for factChecker, treating as plain text')
        const valueStr = String(data.value)
        return valueStr
          .replace(/\{\{newsletterContent\}\}/g, newsletterContent)
          .replace(/\{\{newsletter_content\}\}/g, newsletterContent)
          .replace(/\{\{originalContent\}\}/g, originalContent.substring(0, 2000))
          .replace(/\{\{original_content\}\}/g, originalContent.substring(0, 2000))
      }

      // Check if it's a structured prompt
      if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
        console.log('[AI] Detected structured JSON prompt for factChecker with provider:', provider)

        // Support both camelCase and snake_case placeholders for backward compatibility
        const placeholders = {
          newsletterContent,
          newsletter_content: newsletterContent,
          originalContent: originalContent.substring(0, 2000),
          original_content: originalContent.substring(0, 2000)
        }

        return await callWithStructuredPrompt(promptConfig, placeholders, provider)
      }

      // Plain text prompt - support both placeholder formats
      console.log('[AI] Using plain text prompt for factChecker')
      const configStr = String(promptConfig)
      return configStr
        .replace(/\{\{newsletterContent\}\}/g, newsletterContent)
        .replace(/\{\{newsletter_content\}\}/g, newsletterContent)
        .replace(/\{\{originalContent\}\}/g, originalContent.substring(0, 2000))
        .replace(/\{\{original_content\}\}/g, originalContent.substring(0, 2000))
    } catch (error) {
      console.error('[AI] Error fetching factChecker prompt, using fallback:', error)
      return FALLBACK_PROMPTS.factChecker(newsletterContent, originalContent)
    }
  },
  roadWorkValidator: async (roadWorkItems: any[], date: string) => {
    return FALLBACK_PROMPTS.roadWorkValidator(roadWorkItems, date)
  },

  breakingNewsScorer: async (article: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_breaking_news_scorer')
        .single()

      if (error || !data) {
        console.log('Using code fallback for breakingNewsScorer prompt')
        return FALLBACK_PROMPTS.breakingNewsScorer(article)
      }

      return data.value
        .replace(/\{\{title\}\}/g, article.title)
        .replace(/\{\{description\}\}/g, article.description || 'No description available')
        .replace(/\{\{content\}\}/g, article.content ? article.content.substring(0, 1500) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching breakingNewsScorer prompt, using fallback:', error)
      return FALLBACK_PROMPTS.breakingNewsScorer(article)
    }
  },

  welcomeSection: async (articles: Array<{ headline: string; content: string }>) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value, ai_provider')
        .eq('key', 'ai_prompt_welcome_section')
        .single()

      if (error || !data) {
        console.log('[AI] Using fallback for welcomeSection prompt')
        return FALLBACK_PROMPTS.welcomeSection(articles)
      }

      console.log('[AI] Using database prompt for welcomeSection')
      const provider = (data.ai_provider === 'claude' ? 'claude' : 'openai') as 'openai' | 'claude'

      // Format articles for the prompt
      const articlesText = articles
        .map((article, index) => `${index + 1}. ${article.headline}\n   ${article.content.substring(0, 200)}...`)
        .join('\n\n')

      // Check if value is already an object (JSONB auto-parsed) or needs parsing
      let promptConfig: any
      if (typeof data.value === 'string') {
        // String value - try to parse as JSON
        try {
          promptConfig = JSON.parse(data.value)
        } catch (jsonError) {
          // Not JSON, treat as plain text prompt
          console.log('[AI] Using plain text prompt for welcomeSection')
          return data.value.replace(/\{\{articles\}\}/g, articlesText)
        }
      } else if (typeof data.value === 'object' && data.value !== null) {
        // Already an object (JSONB was auto-parsed)
        promptConfig = data.value
      } else {
        // Unknown format, use as plain text
        console.log('[AI] Unknown value format for welcomeSection, treating as plain text')
        return String(data.value).replace(/\{\{articles\}\}/g, articlesText)
      }

      // Check if it's a structured prompt
      if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
        console.log('[AI] Using structured JSON prompt for welcomeSection with provider:', provider)
        const placeholders = {
          articles: articlesText
        }
        return await callWithStructuredPrompt(promptConfig, placeholders, provider)
      }

      // Plain text prompt
      console.log('[AI] Using plain text prompt for welcomeSection')
      return String(promptConfig).replace(/\{\{articles\}\}/g, articlesText)
    } catch (error) {
      console.error('[AI] Error fetching welcomeSection prompt, using fallback:', error)
      return FALLBACK_PROMPTS.welcomeSection(articles)
    }
  },

  // Multi-Criteria Evaluators (database-driven with fallbacks)
  criteria1Evaluator: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_criteria_1')
        .single()

      if (error || !data || !data.value) {
        console.log('Using code fallback for criteria1Evaluator prompt')
        return FALLBACK_PROMPTS.criteria1Evaluator(post)
      }

      // Ensure value is a string (handle JSONB auto-parsing)
      const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)

      return valueStr
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching criteria1Evaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.criteria1Evaluator(post)
    }
  },

  criteria2Evaluator: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_criteria_2')
        .single()

      if (error || !data || !data.value) {
        console.log('Using code fallback for criteria2Evaluator prompt')
        return FALLBACK_PROMPTS.criteria2Evaluator(post)
      }

      // Ensure value is a string (handle JSONB auto-parsing)
      const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)

      return valueStr
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching criteria2Evaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.criteria2Evaluator(post)
    }
  },

  criteria3Evaluator: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_criteria_3')
        .single()

      if (error || !data || !data.value) {
        console.log('Using code fallback for criteria3Evaluator prompt')
        return FALLBACK_PROMPTS.criteria3Evaluator(post)
      }

      // Ensure value is a string (handle JSONB auto-parsing)
      const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)

      return valueStr
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching criteria3Evaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.criteria3Evaluator(post)
    }
  },

  criteria4Evaluator: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_criteria_4')
        .single()

      if (error || !data || !data.value) {
        console.log('Using code fallback for criteria4Evaluator prompt')
        return FALLBACK_PROMPTS.criteria4Evaluator(post)
      }

      // Ensure value is a string (handle JSONB auto-parsing)
      const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)

      return valueStr
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching criteria4Evaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.criteria4Evaluator(post)
    }
  },

  criteria5Evaluator: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_criteria_5')
        .single()

      if (error || !data || !data.value) {
        console.log('Using code fallback for criteria5Evaluator prompt')
        return FALLBACK_PROMPTS.criteria5Evaluator(post)
      }

      // Ensure value is a string (handle JSONB auto-parsing)
      const valueStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)

      return valueStr
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching criteria5Evaluator prompt, using fallback:', error)
      return FALLBACK_PROMPTS.criteria5Evaluator(post)
    }
  },

  articleWriter: async (post: { title: string; description: string; content?: string; source_url?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_article_writer')
        .single()

      if (error || !data) {
        console.log('Using code fallback for articleWriter prompt')
        return FALLBACK_PROMPTS.articleWriter(post)
      }

      return data.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1500) + '...' : 'No additional content')
        .replace(/\{\{url\}\}/g, post.source_url || '')
    } catch (error) {
      console.error('Error fetching articleWriter prompt, using fallback:', error)
      return FALLBACK_PROMPTS.articleWriter(post)
    }
  }
,

  // Primary Article Title Generator
  primaryArticleTitle: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value, ai_provider')
        .eq('key', 'ai_prompt_primary_article_title')
        .single()

      if (error) {
        console.log('[AI] Error fetching primaryArticleTitle prompt:', error.message)
        console.log('[AI] Using code fallback for primaryArticleTitle prompt')
        return FALLBACK_PROMPTS.primaryArticleTitle(post)
      }

      if (!data || !data.value) {
        console.log('[AI] No database value found for primaryArticleTitle prompt')
        console.log('[AI] Using code fallback for primaryArticleTitle prompt')
        return FALLBACK_PROMPTS.primaryArticleTitle(post)
      }

      const provider = (data.ai_provider === 'claude' ? 'claude' : 'openai') as 'openai' | 'claude'

      // Check if the prompt is JSON (structured format) or plain text
      try {
        const promptConfig = JSON.parse(data.value) as StructuredPromptConfig

        // If it has a messages array, it's a structured prompt
        if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
          console.log('[AI] Using structured database prompt for primaryArticleTitle with provider:', provider)

          // Prepare placeholders
          const placeholders = {
            title: post.title,
            description: post.description || 'No description available',
            content: post.content ? post.content.substring(0, 1000) + '...' : 'No content available'
          }

          // Call with structured format
          return await callWithStructuredPrompt(promptConfig, placeholders, provider)
        }
      } catch (jsonError) {
        // Not JSON, treat as plain text prompt (fallthrough to below)
      }

      // Plain text prompt - use old format
      console.log('[AI] Using plain text database prompt for primaryArticleTitle (length:', data.value.length, 'chars)')
      return data.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('[AI] Error fetching primaryArticleTitle prompt, using fallback:', error)
      return FALLBACK_PROMPTS.primaryArticleTitle(post)
    }
  },

  // Primary Article Body Generator
  primaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, headline: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_primary_article_body')
        .single()

      if (error || !data) {
        console.log('Using code fallback for primaryArticleBody prompt')
        return FALLBACK_PROMPTS.primaryArticleBody(post, headline)
      }

      return data.value
        .replace(/\{\{headline\}\}/g, headline)
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1500) + '...' : 'No additional content')
        .replace(/\{\{url\}\}/g, post.source_url || '')
    } catch (error) {
      console.error('Error fetching primaryArticleBody prompt, using fallback:', error)
      return FALLBACK_PROMPTS.primaryArticleBody(post, headline)
    }
  },

  // Secondary Article Title Generator
  secondaryArticleTitle: async (post: { title: string; description: string; content?: string }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_secondary_article_title')
        .single()

      if (error || !data) {
        console.log('Using code fallback for secondaryArticleTitle prompt')
        return FALLBACK_PROMPTS.secondaryArticleTitle(post)
      }

      return data.value
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1000) + '...' : 'No content available')
    } catch (error) {
      console.error('Error fetching secondaryArticleTitle prompt, using fallback:', error)
      return FALLBACK_PROMPTS.secondaryArticleTitle(post)
    }
  },

  // Secondary Article Body Generator
  secondaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, headline: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_prompt_secondary_article_body')
        .single()

      if (error || !data) {
        console.log('Using code fallback for secondaryArticleBody prompt')
        return FALLBACK_PROMPTS.secondaryArticleBody(post, headline)
      }

      return data.value
        .replace(/\{\{headline\}\}/g, headline)
        .replace(/\{\{title\}\}/g, post.title)
        .replace(/\{\{description\}\}/g, post.description || 'No description available')
        .replace(/\{\{content\}\}/g, post.content ? post.content.substring(0, 1500) + '...' : 'No additional content')
        .replace(/\{\{url\}\}/g, post.source_url || '')
    } catch (error) {
      console.error('Error fetching secondaryArticleBody prompt, using fallback:', error)
      return FALLBACK_PROMPTS.secondaryArticleBody(post, headline)
    }
  }
}

// This function is no longer needed since we use web scraping instead of AI
export async function callOpenAIWithWeb(userPrompt: string, maxTokens = 1000, temperature = 0) {
  throw new Error('Web-enabled AI calls have been replaced with direct web scraping. Use wordle-scraper.ts instead.')
}

// Special function for road work generation using Responses API with web search
export async function callOpenAIWithWebSearch(systemPrompt: string, userPrompt: string): Promise<any> {
  const controller = new AbortController()
  try {
    console.log('Making OpenAI Responses API request with web search...')
    console.log('System prompt length:', systemPrompt.length)
    console.log('User prompt length:', userPrompt.length)

    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) timeout for web search

    try {
      console.log('Using GPT-4o model with web search tools...')

      // Use the Responses API with web tools as provided by the user
      const response = await (openai as any).responses.create({
        model: 'gpt-4o',
        tools: [{ type: 'web_search_preview' }], // correct web search tool type
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Log the full response structure for debugging
      console.log('Full response structure:', JSON.stringify(response, null, 2).substring(0, 1000))

      // Extract the response text using the format from the user's example
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      const text = jsonSchemaItem?.json ??                         // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??         // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        ""

      if (!text) {
        console.error('No text found in response. Response keys:', Object.keys(response))
        throw new Error('No response from OpenAI Responses API')
      }

      console.log('OpenAI Responses API response received, length:', text.length)
      console.log('Response preview:', text.substring(0, 500))

      // Extract JSON array from the response
      const start = text.indexOf("[")
      const end = text.lastIndexOf("]")

      if (start === -1 || end === -1) {
        console.warn('No JSON array found in response')
        console.warn('Full response text:', text.substring(0, 1000))
        return { raw: text }
      }

      const jsonString = text.slice(start, end + 1)
      console.log('Extracted JSON string length:', jsonString.length)
      console.log('JSON preview:', jsonString.substring(0, 300))

      try {
        const parsedData = JSON.parse(jsonString)
        console.log('Successfully parsed road work data:', parsedData.length, 'items')
        if (parsedData.length > 0) {
          console.log('First item:', JSON.stringify(parsedData[0], null, 2))
        }
        return parsedData
      } catch (parseError) {
        console.error('Failed to parse extracted JSON:', parseError)
        console.error('JSON string:', jsonString.substring(0, 500))
        return { raw: text }
      }

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
    console.error('OpenAI Responses API error:', errorMsg)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error name:', error.name)
    }
    throw error
  }
}

function parseJSONResponse(content: string) {
  try {
    // Clean the content - remove any text before/after JSON (support both objects {} and arrays [])
    const objectMatch = content.match(/\{[\s\S]*\}/)
    const arrayMatch = content.match(/\[[\s\S]*\]/)

    if (arrayMatch) {
      // Prefer array match for prompts that expect arrays (like Wordle)
      return JSON.parse(arrayMatch[0])
    } else if (objectMatch) {
      // Use object match for other prompts
      return JSON.parse(objectMatch[0])
    } else {
      // Try parsing the entire content
      return JSON.parse(content.trim())
    }
  } catch (parseError) {
    // Not an error - many prompts return plain text, not JSON
    // Wrap in { raw: content } for calling code to extract
    return { raw: content }
  }
}

// Enhanced OpenAI call with support for structured prompts (system + examples + user)
export interface OpenAICallOptions {
  systemPrompt?: string
  examples?: Array<{ role: 'assistant', content: string }>
  userPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
}

// Interface for structured prompt stored in database
export interface StructuredPromptConfig {
  model?: string
  max_output_tokens?: number
  temperature?: number
  top_p?: number
  response_format?: any  // Allow any response_format structure
  text?: any  // OpenAI Responses API format (for JSON schema, etc.)
  messages?: Array<{
    role: 'system' | 'assistant' | 'user'
    content: string | any  // Allow string or array (Responses API format)
  }>
  input?: Array<{
    role: 'system' | 'assistant' | 'user'
    content: string | any  // Responses API uses content as array
  }>  // OpenAI Responses API uses 'input' instead of 'messages'
}

// Helper function to call OpenAI or Claude with structured prompt from database
// Sends the JSON prompt EXACTLY as-is (with placeholder replacement only)
export async function callWithStructuredPrompt(
  promptConfig: StructuredPromptConfig,
  placeholders: Record<string, string> = {},
  provider: 'openai' | 'claude' = 'openai',
  promptKey?: string
): Promise<any> {
  // Validate promptConfig structure
  if (!promptConfig || typeof promptConfig !== 'object') {
    throw new Error('Invalid promptConfig: must be an object')
  }
  
  // Accept either 'input' (Responses API format) or 'messages' (standard format)
  // Normalize to 'messages' internally for processing
  const messagesArray = promptConfig.messages || promptConfig.input
  if (!messagesArray || !Array.isArray(messagesArray)) {
    throw new Error('Invalid promptConfig: must have either "messages" or "input" array')
  }
  
  // If promptConfig has 'input' but not 'messages', normalize it to 'messages' for internal use
  // We'll convert back to 'input' when sending to Responses API if needed
  if (!promptConfig.messages && promptConfig.input) {
    promptConfig.messages = promptConfig.input
  }
  

  // Deep clone the entire config to avoid mutating the original
  const apiRequest = JSON.parse(JSON.stringify(promptConfig))

  // Replace placeholders recursively in the entire object
  function replacePlaceholders(obj: any): any {
    if (typeof obj === 'string') {
      return Object.entries(placeholders).reduce(
        (str, [key, value]) => str.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
        obj
      )
    }
    if (Array.isArray(obj)) {
      return obj.map(item => replacePlaceholders(item))
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {}
      for (const key in obj) {
        result[key] = replacePlaceholders(obj[key])
      }
      return result
    }
    return obj
  }

  // Replace all placeholders in the entire config
  const processedRequest = replacePlaceholders(apiRequest)

  // Log subject line API calls (full request)
  const isSubjectLine = promptKey === 'ai_prompt_subject_line'
  if (isSubjectLine) {
    try {
      const requestString = JSON.stringify(processedRequest, null, 2)
      const lines = requestString.split('\n')
      const first20Lines = lines.slice(0, 20).join('\n')
      const remainingLines = lines.length - 20
      console.log(`[Subject Line API Request] Provider: ${provider}, Prompt Key: ${promptKey}`)
      console.log(`[Subject Line API Request] First 20 lines (${remainingLines > 0 ? `${remainingLines} more lines...` : 'complete'}):`)
      console.log(first20Lines)
      if (remainingLines > 0) {
        console.log(`[Subject Line API Request] ... (${remainingLines} more lines)`)
      }
    } catch (logError) {
      console.error('[Subject Line API Request] Failed to log request:', logError)
    }
  }

  // Add timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5

  try {
    let content: string = ''

    if (provider === 'claude') {
      // Claude API - send exactly as-is (messages stays as messages)
      console.log(`[AI] Using Claude API for prompt (provider: ${provider})`)

      // Log full Claude API call for subject line
      if (isSubjectLine) {
        const fullRequestString = JSON.stringify(processedRequest, null, 2)
        console.log(`[Subject Line API Call] Full Claude API call:`)
        console.log(`await anthropic.messages.create(`)
        console.log(fullRequestString)
        console.log(`, {`)
        console.log(`  signal: controller.signal`)
        console.log(`} as any)`)
      }

      const response = await anthropic.messages.create(processedRequest, {
        signal: controller.signal
      } as any)

      clearTimeout(timeoutId)

      // Extract content from Claude response
      const textContent = response.content.find((c: any) => c.type === 'text')
      content = textContent && 'text' in textContent ? textContent.text : ''

      if (!content) {
        throw new Error('No response from Claude')
      }
    } else {
      // OpenAI Responses API - only rename messages to input (API requirement)
      console.log(`[AI] Using OpenAI API for prompt (provider: ${provider})`)
      if (processedRequest.messages) {
        processedRequest.input = processedRequest.messages
        delete processedRequest.messages
      }

      // Log full OpenAI API call for subject line
      if (isSubjectLine) {
        const fullRequestString = JSON.stringify(processedRequest, null, 2)
        console.log(`[Subject Line API Call] Full OpenAI API call:`)
        console.log(`await (openai as any).responses.create(`)
        console.log(fullRequestString)
        console.log(`, {`)
        console.log(`  signal: controller.signal`)
        console.log(`})`)
      }

      const response = await (openai as any).responses.create(processedRequest, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Extract content from Responses API format
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawContent = jsonSchemaItem?.json ??                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        response.output_text ??                                   // Legacy location
        response.text ??
        ""

      if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
        console.error('[AI] No content found in OpenAI response:', JSON.stringify({
          hasOutput: !!response.output,
          outputLength: response.output?.length,
          outputText: response.output_text,
          responseKeys: Object.keys(response || {})
        }, null, 2))
        throw new Error('No response from OpenAI')
      }

      // If rawContent is already a parsed object/array (from JSON schema), use it directly
      // This matches the test endpoint behavior - if it's an object, use it as-is
      if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
        // Check if it's the response wrapper (has 'output', 'output_text', 'id')
        if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
          // This is the response wrapper - try to extract actual content
          const extracted = rawContent.output_text ?? rawContent.text
          if (extracted && typeof extracted !== 'object') {
            // Extracted content is a string, continue to parsing
            rawContent = extracted
          } else if (extracted && typeof extracted === 'object') {
            // Extracted content is already parsed, use it
            return extracted
          } else {
            // Can't extract, might be valid response structure
            return rawContent
          }
        } else {
          // Already the parsed AI response content (from JSON schema)
          return rawContent
        }
      } else if (Array.isArray(rawContent)) {
        // Already a parsed array (from JSON schema)
        return rawContent
      }
      
      // Otherwise, it's a string that needs parsing
      content = typeof rawContent === 'string' ? rawContent : String(rawContent)
    }

    // Try to parse as JSON, fallback to raw content (same for both providers)
    try {
      // Ensure content is defined and is a string (should be set in if/else above)
      if (typeof content === 'undefined') {
        console.error('[AI] Content variable is undefined - this should not happen')
        return { raw: 'Content was undefined' }
      }

      // Validate content is a string
      if (!content || typeof content !== 'string') {
        console.error('[AI] Invalid content type for parsing:', typeof content, content)
        return { raw: content }
      }

      let cleanedContent: string = String(content) // Ensure it's definitely a string
      try {
        const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
          cleanedContent = codeFenceMatch[1]
        }
      } catch (matchError) {
        // If regex matching fails, use original content
        console.warn('[AI] Regex match failed, using original content:', matchError)
        cleanedContent = String(content)
      }

      // Validate cleanedContent is still a string
      if (!cleanedContent || typeof cleanedContent !== 'string') {
        console.error('[AI] Invalid cleanedContent after code fence removal:', typeof cleanedContent, cleanedContent)
        return { raw: content }
      }

      // Ensure cleanedContent is still a valid string before calling .match()
      if (!cleanedContent || typeof cleanedContent !== 'string') {
        console.error('[AI] cleanedContent is not a string before regex matching:', typeof cleanedContent, cleanedContent)
        return { raw: content }
      }

      let objectMatch: RegExpMatchArray | null = null
      let arrayMatch: RegExpMatchArray | null = null
      
      try {
        objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
      } catch (matchError) {
        console.warn('[AI] Object match failed:', matchError)
      }
      
      try {
        arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
      } catch (matchError) {
        console.warn('[AI] Array match failed:', matchError)
      }

      // Match test endpoint logic exactly - check both match and [0] exists
      if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
        return JSON.parse(arrayMatch[0])
      } else if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
        return JSON.parse(objectMatch[0])
      } else {
        return JSON.parse(cleanedContent.trim())
      }
    } catch (parseError) {
      // Return raw content wrapped in object
      return { raw: content }
    }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Universal AI caller - loads prompt from database and calls AI
 * This is the NEW standard way to call AI - prompts are complete JSON stored in database
 *
 * @param promptKey - Key in app_settings table (e.g. 'ai_prompt_primary_article_title')
 * @param placeholders - Object with placeholder values (e.g. {title: '...', content: '...'})
 * @param fallbackText - Optional fallback text if prompt not in database
 * @returns Parsed JSON response from AI
 */
export async function callAIWithPrompt(
  promptKey: string,
  newsletterId: string,
  placeholders: Record<string, string> = {},
  fallbackText?: string
): Promise<any> {
  // Load complete JSON prompt from database
  const promptJSON = await getPromptJSON(promptKey, newsletterId, fallbackText)

  // Extract provider info
  const provider = promptJSON._provider || 'openai'

  // Remove internal fields before sending to API
  delete promptJSON._provider

  // Call AI with complete structured prompt (pass promptKey for subject line logging)
  return await callWithStructuredPrompt(promptJSON, placeholders, provider, promptKey)
}

export async function callOpenAIStructured(options: OpenAICallOptions) {
  try {
    const {
      systemPrompt,
      examples = [],
      userPrompt,
      maxTokens = 1000,
      temperature = 0.3,
      topP,
      presencePenalty,
      frequencyPenalty
    } = options

    // Build messages array
    const messages: Array<{ role: 'system' | 'assistant' | 'user', content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // Add few-shot examples
    examples.forEach(example => {
      messages.push(example)
    })

    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt })
    }

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5 // 30 second timeout

    try {
      const requestOptions: any = {
        model: 'gpt-4o',
        messages,
        max_output_tokens: maxTokens,
        temperature
      }

      // Add optional parameters if provided
      if (topP !== undefined) requestOptions.top_p = topP
      if (presencePenalty !== undefined) requestOptions.presence_penalty = presencePenalty
      if (frequencyPenalty !== undefined) requestOptions.frequency_penalty = frequencyPenalty

      // Debug: Log what we're actually sending to OpenAI
      console.log('[AI] Sending to OpenAI - messages count:', messages.length)
      messages.forEach((msg, i) => {
        console.log(`[AI] Final message ${i} - role: ${msg.role}, content type: ${typeof msg.content}, content preview:`,
          typeof msg.content === 'string' ? msg.content.substring(0, 50) : JSON.stringify(msg.content).substring(0, 50))
      })

      // Convert messages format to input format for Responses API
      const inputMessages = requestOptions.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await (openai as any).responses.create({
        model: requestOptions.model,
        input: inputMessages,
        temperature: requestOptions.temperature,
        max_output_tokens: requestOptions.max_output_tokens,
        ...(requestOptions.top_p !== undefined && { top_p: requestOptions.top_p }),
        ...(requestOptions.presence_penalty !== undefined && { presence_penalty: requestOptions.presence_penalty }),
        ...(requestOptions.frequency_penalty !== undefined && { frequency_penalty: requestOptions.frequency_penalty })
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Extract content from Responses API format
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawContent = jsonSchemaItem?.json ??                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        response.output_text ??                                   // Legacy location
        response.text ??
        ""
      
      if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
        console.error('[AI] No content found in OpenAI response:', JSON.stringify({
          hasOutput: !!response.output,
          outputLength: response.output?.length,
          outputText: response.output_text,
          responseKeys: Object.keys(response || {})
        }, null, 2))
        throw new Error('No response from OpenAI')
      }

      // If rawContent is already a parsed object/array (from JSON schema), use it directly
      if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
        // Check if it's the response wrapper (has 'output', 'output_text', 'id')
        if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
          // This is the response wrapper - try to extract actual content
          const extracted = rawContent.output_text ?? rawContent.text
          if (extracted && typeof extracted !== 'object') {
            rawContent = extracted
          } else if (extracted && typeof extracted === 'object') {
            return extracted
          } else {
            return rawContent
          }
        } else {
          // Already the parsed AI response content (from JSON schema)
          return rawContent
        }
      } else if (Array.isArray(rawContent)) {
        // Already a parsed array (from JSON schema)
        return rawContent
      }

      // Otherwise, it's a string that needs parsing
      const content = typeof rawContent === 'string' ? rawContent : String(rawContent)

      // Try to parse as JSON, fallback to raw content
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing:', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          // If regex matching fails, use original content
          console.warn('[AI] Regex match failed in callOpenAIWithStructuredOptions, using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching in callOpenAI:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null
        
        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callOpenAI:', matchError)
        }
        
        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callOpenAI:', matchError)
        }

        if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          return JSON.parse(arrayMatch[0])
        } else if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          return JSON.parse(objectMatch[0])
        } else {
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Return plain text wrapped in object
        return { raw: content }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    const errorMsg = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
    console.error('OpenAI API error (structured):', errorMsg)
    throw error
  }
}

// Original function - kept for backward compatibility
export async function callOpenAI(prompt: string, maxTokens = 1000, temperature = 0.3) {
  try {
    // console.log('Calling OpenAI API...') // Commented out to reduce log count

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5 // 30 second timeout

    try {
      // console.log('Using GPT-4o model with improved JSON parsing...') // Commented out to reduce log count
      const response = await (openai as any).responses.create({
        model: 'gpt-4o',
        input: [{ role: 'user', content: prompt }],
        max_output_tokens: maxTokens,
        temperature: temperature,
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Extract content from Responses API format
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawContent = jsonSchemaItem?.json ??                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        response.output_text ??                                   // Legacy location
        response.text ??
        ""

      if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
        console.error('[AI] No content found in OpenAI response:', JSON.stringify({
          hasOutput: !!response.output,
          outputLength: response.output?.length,
          outputText: response.output_text,
          responseKeys: Object.keys(response || {})
        }, null, 2))
        throw new Error('No response from OpenAI')
      }

      // If rawContent is already a parsed object/array (from JSON schema), use it directly
      // This matches the test endpoint behavior - if it's an object, use it as-is
      if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
        // Check if it's the response wrapper (has 'output', 'output_text', 'id')
        if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
          // This is the response wrapper - try to extract actual content
          const extracted = rawContent.output_text ?? rawContent.text
          if (extracted && typeof extracted !== 'object') {
            // Extracted content is a string, continue to parsing
            rawContent = extracted
          } else if (extracted && typeof extracted === 'object') {
            // Extracted content is already parsed, use it
            return extracted
          } else {
            // Can't extract, might be valid response structure
            return rawContent
          }
        } else {
          // Already the parsed AI response content (from JSON schema)
          return rawContent
        }
      } else if (Array.isArray(rawContent)) {
        // Already a parsed array (from JSON schema)
        return rawContent
      }

      // console.log('OpenAI response received') // Commented out to reduce log count

      // Otherwise, it's a string that needs parsing
      const content = typeof rawContent === 'string' ? rawContent : String(rawContent)

      // Try to parse as JSON, fallback to raw content
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing:', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first (```json ... ``` or ``` ... ```)
        // Match test endpoint logic exactly - it doesn't validate codeFenceMatch[1]
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          // If regex matching fails, use original content
          console.warn('[AI] Regex match failed in callOpenAI, using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Clean the content - remove any text before/after JSON (support both objects {} and arrays [])
        // Match test endpoint logic exactly
        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null
        
        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callWithStructuredPrompt:', matchError)
        }
        
        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callWithStructuredPrompt:', matchError)
        }

        if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          // Prefer array match for prompts that expect arrays (like road work)
          return JSON.parse(arrayMatch[0])
        } else if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          // Use object match for other prompts
          return JSON.parse(objectMatch[0])
        } else {
          // Try parsing the entire content
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Not an error - many prompts return plain text, not JSON
        // Wrap in { raw: content } for calling code to extract
        return { raw: content }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    console.error('OpenAI API error with GPT-5:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error name:', error.name)
      console.error('Error stack:', error.stack)
    }
    // Log additional error details for debugging
    if (typeof error === 'object' && error !== null) {
      console.error('Full error object:', JSON.stringify(error, null, 2))
    }
    throw error
  }
}

// Unified AI caller - routes to OpenAI or Claude based on provider
export async function callAI(prompt: string, maxTokens = 1000, temperature = 0.3, provider: 'openai' | 'claude' = 'openai') {
  if (provider === 'claude') {
    // Claude API call
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [{ role: 'user', content: prompt }]
      })

      const textContent = response.content.find(c => c.type === 'text')
      const content = textContent && 'text' in textContent ? textContent.text : ''

      if (!content) {
        throw new Error('No response from Claude')
      }

      // Try to parse as JSON, fallback to raw content (same logic as OpenAI)
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing in callAI (Claude):', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          console.warn('[AI] Regex match failed in callAI (Claude), using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal in callAI (Claude):', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching in callAI (Claude):', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null
        
        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callAI (Claude):', matchError)
        }
        
        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callAI (Claude):', matchError)
        }

        if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          return JSON.parse(arrayMatch[0])
        } else if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          return JSON.parse(objectMatch[0])
        } else {
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Return raw content wrapped in object
        return { raw: content }
      }
    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Claude API error:', errorMsg)
      throw error
    }
  } else {
    // OpenAI API call (default)
    return callOpenAI(prompt, maxTokens, temperature)
  }
}

// Complete AI call interface - fetches prompt+provider, replaces placeholders, calls AI
export const AI_CALL = {
  contentEvaluator: async (post: { title: string; description: string; content?: string; hasImage?: boolean }, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    const imagePenaltyText = post.hasImage
      ? 'This post HAS an image.'
      : 'This post has NO image - subtract 5 points from interest_level.'

    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_content_evaluator', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1000) + '...' : 'No content available',
      imagePenalty: imagePenaltyText
    })
  },

  primaryArticleTitle: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, maxTokens = 200, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_primary_article_title', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || ''
    })
  },

  primaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, headline: string, maxTokens = 500, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_primary_article_body', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || '',
      headline: headline
    })
  },

  secondaryArticleTitle: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, maxTokens = 200, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_secondary_article_title', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || ''
    })
  },

  secondaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, headline: string, maxTokens = 500, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_secondary_article_body', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || '',
      headline: headline
    })
  },

  subjectLineGenerator: async (top_article: { headline: string; content: string }, newsletterId: string, maxTokens = 100, temperature = 0.8) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_subject_line', newsletterId, {
      headline: top_article.headline,
      content: top_article.content
    })
  },

  welcomeSection: async (articles: Array<{ headline: string; content: string }>, newsletterId: string, maxTokens = 500, temperature = 0.8) => {
    // Format articles as JSON string for placeholder replacement
    const articlesJson = JSON.stringify(articles.map(a => ({
      headline: a.headline,
      content: a.content.substring(0, 1000) + (a.content.length > 1000 ? '...' : '')
    })))

    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_welcome_section', newsletterId, {
      articles: articlesJson
    })
  },

  topicDeduper: async (posts: Array<{ title: string; description: string; full_article_text: string }>, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    // Format posts as numbered list for placeholder replacement
    const postsFormatted = posts.map((post, i) =>
      `${i}. Title: ${post.title}\n   Description: ${post.description || 'No description'}\n   Full Article: ${post.full_article_text ? post.full_article_text.substring(0, 1500) + (post.full_article_text.length > 1500 ? '...' : '') : 'No full text available'}`
    ).join('\n\n')

    // Use callAIWithPrompt to load complete config from database
    // Support both {{articles}} and {{posts}} placeholders for compatibility
    return callAIWithPrompt('ai_prompt_topic_deduper', newsletterId, {
      articles: postsFormatted,
      posts: postsFormatted  // Also support {{posts}} placeholder
    })
  },

  factChecker: async (newsletterContent: string, originalContent: string, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_fact_checker', newsletterId, {
      newsletter_content: newsletterContent,
      original_content: originalContent
    })
  }
}
