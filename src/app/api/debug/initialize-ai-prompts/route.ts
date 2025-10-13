import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Initialize AI prompts in database with default values from code
export async function GET() {
  try {
    const defaultPrompts = [
      {
        key: 'ai_prompt_content_evaluator',
        category: 'Article Processing',
        name: 'Content Evaluator',
        description: 'Evaluates RSS articles for interest level, local relevance, and community impact',
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
        category: 'Article Processing',
        name: 'Newsletter Writer',
        description: 'Converts RSS articles into concise newsletter summaries',
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
        category: 'Newsletter',
        name: 'Subject Line Generator',
        description: 'Creates engaging subject lines based on top article (max 35 characters)',
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
        category: 'Events',
        name: 'Event Summarizer',
        description: 'Creates natural 50-word summaries for featured events',
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
        category: 'Infrastructure',
        name: 'Road Work Generator',
        description: 'Generates 9 road work items for St. Cloud area from government sources',
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
        category: 'Images',
        name: 'Image Analyzer',
        description: 'Analyzes uploaded images with AI tagging, OCR, and metadata extraction',
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

IMPORTANT: Only include OCR fields if readable text is actually present. Only include age_groups if people are visible and ages can be reasonably estimated. Set to null if not detected. Prioritize tags that match the St. Cloud newsletter's common article themes: education, public safety, community events, sports (especially hockey), seasonal activities, business development, and healthcare.`
      }
    ]

    const results = []
    for (const prompt of defaultPrompts) {
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('key')
        .eq('key', prompt.key)
        .single()

      if (!existing) {
        const { error } = await supabaseAdmin
          .from('app_settings')
          .insert([{
            key: prompt.key,
            value: prompt.value,
            description: `${prompt.category} - ${prompt.name}: ${prompt.description}`
          }])

        if (error) {
          results.push({ key: prompt.key, status: 'error', error: error.message })
        } else {
          results.push({ key: prompt.key, status: 'created' })
        }
      } else {
        results.push({ key: prompt.key, status: 'exists' })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'AI prompts initialized',
      results
    })

  } catch (error) {
    console.error('Error initializing AI prompts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
