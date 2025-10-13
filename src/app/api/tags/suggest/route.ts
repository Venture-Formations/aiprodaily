import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

interface TagSuggestion {
  formatted_tag: string
  display_name: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const { input, existing_tags = [] } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input text is required' },
        { status: 400 }
      )
    }

    const excludeText = existing_tags.length > 0
      ? `\n\nDO NOT suggest any of these existing tags: ${existing_tags.join(', ')}`
      : ''

    const prompt = `You are an AI that analyzes image descriptions and suggests relevant tags. Given the user input "${input}", analyze what they're describing and suggest 6-10 diverse, contextually relevant image tags.${excludeText}

IMPORTANT: Don't just add prefixes to their words. Think about the CONTEXT and IMPLICATIONS of what they're describing.

Examples:
- Input: "kids at school playing on playground" → tags like: scene_playground, scene_school, people_children, activity_playing, mood_playful, location_outdoor, theme_education, activity_recreation
- Input: "bed" → tags like: object_bed, scene_bedroom, location_indoor, theme_rest, mood_peaceful, style_furniture, activity_sleeping
- Input: "sunset over mountains" → tags like: scene_mountain, time_sunset, weather_clear, mood_peaceful, color_orange, location_outdoor, theme_nature, style_landscape

Return ONLY a JSON array of tag suggestions with this exact structure:
[
  {
    "formatted_tag": "scene_playground",
    "display_name": "Scene: Playground",
    "confidence": 0.95
  },
  {
    "formatted_tag": "people_children",
    "display_name": "People: Children",
    "confidence": 0.90
  }
]

Tag categories and guidelines:
- object_* : Physical items, furniture, vehicles, tools, etc.
- scene_* : Locations, environments, settings (bedroom, kitchen, office, park)
- people_* : Types of people, groups, ages (children, adults, family, crowd)
- activity_* : Actions, behaviors (playing, working, exercising, cooking)
- mood_* : Emotional tone (playful, serious, peaceful, energetic, romantic)
- theme_* : Concepts, purposes (education, business, nature, family, celebration)
- style_* : Visual styles, aesthetics (modern, vintage, minimalist, rustic)
- color_* : Dominant colors (red, blue, warm_tones, bright)
- time_* : Time of day, season (morning, sunset, winter, summer)
- weather_* : Weather conditions (sunny, cloudy, rainy, snowy)
- location_* : General location types (indoor, outdoor, urban, rural)

For "${input}", analyze the context and suggest relevant tags from different categories. Be intelligent about implications - don't just format their words.

Return valid JSON array only, no other text.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    try {
      // Parse AI response
      const suggestions: TagSuggestion[] = JSON.parse(content.trim())

      // Validate response format
      if (!Array.isArray(suggestions)) {
        throw new Error('Response is not an array')
      }

      // Validate each suggestion and filter out existing tags
      const validSuggestions = suggestions.filter(suggestion =>
        suggestion.formatted_tag &&
        suggestion.display_name &&
        typeof suggestion.confidence === 'number' &&
        !existing_tags.includes(suggestion.formatted_tag) // Filter out existing tags
      )

      // Return only the AI-generated contextual suggestions (no direct input formatting)
      const finalSuggestions = validSuggestions

      return NextResponse.json({ suggestions: finalSuggestions })

    } catch (parseError) {
      console.error('Failed to parse AI tag suggestions:', parseError)
      console.error('AI response:', content)

      // Fallback: If AI parsing fails, return contextual suggestions based on common patterns
      // But avoid simple prefix formatting - try to be contextual
      const inputLower = input.toLowerCase()
      let fallbackSuggestions = []

      // Try to detect context and provide relevant suggestions
      if (inputLower.includes('kid') || inputLower.includes('child') || inputLower.includes('school')) {
        fallbackSuggestions.push(
          { formatted_tag: 'people_children', display_name: 'People: Children', confidence: 0.8 },
          { formatted_tag: 'theme_education', display_name: 'Theme: Education', confidence: 0.7 }
        )
      }
      if (inputLower.includes('play') || inputLower.includes('fun')) {
        fallbackSuggestions.push(
          { formatted_tag: 'activity_playing', display_name: 'Activity: Playing', confidence: 0.8 },
          { formatted_tag: 'mood_playful', display_name: 'Mood: Playful', confidence: 0.7 }
        )
      }
      if (inputLower.includes('bed') || inputLower.includes('sleep')) {
        fallbackSuggestions.push(
          { formatted_tag: 'object_bed', display_name: 'Object: Bed', confidence: 0.9 },
          { formatted_tag: 'scene_bedroom', display_name: 'Scene: Bedroom', confidence: 0.8 },
          { formatted_tag: 'activity_sleeping', display_name: 'Activity: Sleeping', confidence: 0.7 },
          { formatted_tag: 'location_indoor', display_name: 'Location: Indoor', confidence: 0.6 }
        )
      }

      // Filter out existing tags from fallback suggestions
      const filteredFallbackSuggestions = fallbackSuggestions.filter(
        suggestion => !existing_tags.includes(suggestion.formatted_tag)
      )

      return NextResponse.json({
        suggestions: filteredFallbackSuggestions,
        fallback: true
      })
    }

  } catch (error) {
    console.error('Tag suggestion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}