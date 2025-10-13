import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      console.log(`Using code fallback for prompt: ${key}`)
      return fallback
    }

    console.log(`Using database prompt: ${key}`)
    return data.value
  } catch (error) {
    console.error(`Error fetching prompt ${key}, using fallback:`, error)
    return fallback
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
Article Content: ${post.content ? post.content.substring(0, 1000) + '...' : 'No content available'}

IMPORTANT: You must respond with ONLY valid JSON. Do not include any text before or after the JSON.
The interest_level field MUST be between 1 and 20, NOT between 1 and 10.

Response format:
{
  "interest_level": <integer 1-20, use full range>,
  "local_relevance": <integer 1-10>,
  "community_impact": <integer 1-10>,
  "reasoning": "<detailed explanation of your scoring>"
}`,

  topicDeduper: (posts: Array<{ title: string; description: string }>) => `
You are identifying duplicate stories for a LOCAL NEWSLETTER. Your goal is to prevent readers from seeing multiple articles about the SAME TYPE OF EVENT or SIMILAR TOPICS.

CRITICAL DEDUPLICATION RULES:
1. Group articles about the SAME TYPE of event (e.g., multiple fire department open houses, multiple school events, multiple business openings)
2. Group articles covering the SAME news story from different sources
3. Group articles about SIMILAR community activities happening in the same time period
4. Be AGGRESSIVE in identifying duplicates - err on the side of grouping similar topics together
5. For each group, keep the article with the MOST SPECIFIC details (names, dates, locations)

EXAMPLES OF DUPLICATES:
- "Sartell Fire Dept Open House Oct 12" + "St. Cloud Fire Station Open House Oct 12" + "Sauk Rapids Fire Dept Open House Oct 12" → ALL DUPLICATES (same type of event)
- "New restaurant opens in St. Cloud" + "Grand opening for local eatery" → DUPLICATES (same story)
- "School district meeting tonight" + "Board to discuss budget tonight" → DUPLICATES (same event)

Articles to analyze (array indices are 0-based - first article is index 0):
${posts.map((post, i) => `${i}. ${post.title}\n   ${post.description || 'No description'}`).join('\n\n')}

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
Content: ${post.content ? post.content.substring(0, 1500) + '...' : 'No additional content'}

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
PASSING THRESHOLD: 20/30 minimum

Respond with valid JSON in this exact format:
{
  "score": <number 3-30>,
  "details": "<detailed list of all violations found or 'none'>",
  "passed": <boolean true if score >= 20, false otherwise>
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

  subjectLineGenerator: (articles: Array<{ headline: string; content: string }>) => `
Craft a front-page newspaper headline for the next-day edition based on the most interesting article.

Articles in this newsletter:
${articles.map((article, i) => `${i + 1}. ${article.headline}\n   ${article.content.substring(0, 100)}...`).join('\n\n')}

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

  roadWorkGenerator: (campaignDate: string) => `
Find CURRENT and ACTIVE road, lane, or bridge closures, detours, or traffic restrictions in effect on ${campaignDate} within 10 miles of ZIP code 56303 (St. Cloud, MN metro area).

CRITICAL DATE REQUIREMENT:
- ONLY include projects that are ACTIVE on ${campaignDate}
- Expected reopen date must be AFTER ${campaignDate} (not completed yet)
- Start date must be ON OR BEFORE ${campaignDate} (already begun)
- Do NOT include completed projects from summer 2025 or earlier
- MUST have CONFIRMED specific dates (e.g., "Oct 15", "Nov 30") - NO vague ranges like "Fall 2026" or "TBD"
- REJECT any items with unconfirmed or vague date ranges

SEARCH CRITERIA:
- Date: ${campaignDate}
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
- Projects that started before ${campaignDate} but are still ongoing

STRICTLY EXCLUDE:
- Completed closures (reopen date before ${campaignDate})
- Planned/future closures (start date after ${campaignDate})
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

      console.log('Using database prompt for contentEvaluator')
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

      console.log('Using database prompt for newsletterWriter')
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

      console.log('Using database prompt for eventSummarizer')
      return data.value
        .replace(/\{\{title\}\}/g, event.title)
        .replace(/\{\{description\}\}/g, event.description || 'No description available')
        .replace(/\{\{venue\}\}/g, event.venue || 'No venue specified')
    } catch (error) {
      console.error('Error fetching eventSummarizer prompt, using fallback:', error)
      return FALLBACK_PROMPTS.eventSummarizer(event)
    }
  },

  subjectLineGenerator: async (articles: Array<{ headline: string; content: string }>) => {
    // subjectLineGenerator doesn't support database templates - always use fallback
    return FALLBACK_PROMPTS.subjectLineGenerator(articles)
  },

  roadWorkGenerator: async (campaignDate: string) => {
    // roadWorkGenerator doesn't support database templates - always use fallback
    return FALLBACK_PROMPTS.roadWorkGenerator(campaignDate)
  },

  imageAnalyzer: async () => {
    return await getPrompt(
      'ai_prompt_image_analyzer',
      FALLBACK_PROMPTS.imageAnalyzer()
    )
  },

  // Non-editable prompts (not stored in database)
  topicDeduper: async (posts: Array<{ title: string; description: string }>) => {
    return FALLBACK_PROMPTS.topicDeduper(posts)
  },
  factChecker: async (newsletterContent: string, originalContent: string) => {
    return FALLBACK_PROMPTS.factChecker(newsletterContent, originalContent)
  },
  roadWorkValidator: async (roadWorkItems: any[], date: string) => {
    return FALLBACK_PROMPTS.roadWorkValidator(roadWorkItems, date)
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

    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 second timeout for web search

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
      const text = response.output_text ?? response.output?.[0]?.content?.[0]?.text ?? ""

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
    console.error('OpenAI Responses API error:', error)
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
    console.warn('Failed to parse OpenAI response as JSON. Content length:', content.length)
    console.warn('Content preview:', content.substring(0, 200))
    console.warn('Parse error:', parseError instanceof Error ? parseError.message : parseError)
    return { raw: content }
  }
}

export async function callOpenAI(prompt: string, maxTokens = 1000, temperature = 0.3) {
  try {
    console.log('Calling OpenAI API...')

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      console.log('Using GPT-4o model with improved JSON parsing...')
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature,
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      console.log('OpenAI response received')

      // Try to parse as JSON, fallback to raw content
      try {
        // Strip markdown code fences first (```json ... ``` or ``` ... ```)
        let cleanedContent = content
        const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeFenceMatch) {
          cleanedContent = codeFenceMatch[1]
          console.log('Stripped markdown code fences from response')
        }

        // Clean the content - remove any text before/after JSON (support both objects {} and arrays [])
        const objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        const arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)

        if (arrayMatch) {
          // Prefer array match for prompts that expect arrays (like road work)
          return JSON.parse(arrayMatch[0])
        } else if (objectMatch) {
          // Use object match for other prompts
          return JSON.parse(objectMatch[0])
        } else {
          // Try parsing the entire content
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        console.warn('Failed to parse OpenAI response as JSON. Content length:', content.length)
        console.warn('Content preview:', content.substring(0, 200))
        console.warn('Parse error:', parseError instanceof Error ? parseError.message : parseError)
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