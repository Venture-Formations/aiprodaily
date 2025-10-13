import { NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const maxDuration = 60

export async function GET() {
  try {
    // Test with the three fire department articles
    const testPosts = [
      {
        title: "🚒🔥 Big shout-out to Rockville Fire Chief Rodney Schaefer and his amazing team of Rockville firefighters! Their dedicat...",
        description: "🚒🔥 Big shout-out to Rockville Fire Chief Rodney Schaefer and his amazing team of Rockville firefighters!\n Their dedication, teamwork, and heart for the community make them true hometown heroes. \n Ch..."
      },
      {
        title: "It's Fire Prevention Week and the City of Sartell Fire Department is hosting an open house on Saturday, October ...",
        description: "It's Fire Prevention Week and the City of Sartell Fire Department is hosting an open house on Saturday, October 12, 2024, from 10 a.m. to 2 p.m.\n \n \n We'll have lots of fun fire safety activities..."
      },
      {
        title: "It's Fire Prevention Week, and in honor of that, some local fire stations are holding open house events. St. C...",
        description: "It's Fire Prevention Week, and in honor of that, some local fire stations are holding open house events.\n St. Cloud Fire Station #2 will be holding theirs on October 12 from 11am to 1pm. There wi..."
      },
      {
        title: "Sauk Rapids Fire Department will hold a fire prevention week open house on Saturday, October 12, from 10:00 a.m....",
        description: "Sauk Rapids Fire Department will hold a fire prevention week open house on Saturday, October 12, from 10:00 a.m. to 2:00 p.m. at Sauk Rapids Fire Station 1, located at 525 5th Avenue South. Attende..."
      }
    ]

    console.log('=== TESTING TOPIC DEDUPER WITH FIRE DEPT ARTICLES ===')
    console.log(`Processing ${testPosts.length} posts`)

    const prompt = await AI_PROMPTS.topicDeduper(testPosts)

    console.log('=== DEDUPER PROMPT (first 500 chars) ===')
    console.log(prompt.substring(0, 500))

    const result = await callOpenAI(prompt)

    console.log('=== DEDUPER RESULT ===')
    console.log('Result type:', typeof result)
    console.log('Has groups?', !!result.groups)
    console.log('Groups length:', result.groups?.length || 0)
    console.log('Full result:', JSON.stringify(result, null, 2))

    // If result has .raw, try to extract JSON manually
    let parsedResult = result
    if (result.raw && !result.groups) {
      console.log('Result has .raw field, attempting manual JSON extraction...')
      const jsonMatch = result.raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0])
          console.log('Successfully parsed JSON from .raw field')
        } catch (e) {
          console.error('Failed to parse JSON from .raw:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      test_posts: testPosts.map((p, i) => ({ index: i, title: p.title.substring(0, 80) + '...' })),
      deduper_result: result,
      parsed_result: parsedResult,
      duplicate_groups_found: parsedResult.groups?.length || 0,
      analysis: {
        expected_duplicates: "Articles 1, 2, and 3 are all about Fire Department open houses",
        article_0: "Rockville Fire Chief award (different topic)",
        article_1: "Sartell Fire Dept open house Oct 12",
        article_2: "St. Cloud Fire Station #2 open house Oct 12",
        article_3: "Sauk Rapids Fire Dept open house Oct 12"
      }
    })

  } catch (error) {
    console.error('Test deduper error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
