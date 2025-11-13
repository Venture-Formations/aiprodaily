import { NextRequest, NextResponse } from 'next/server'
import { callAIWithPrompt } from '@/lib/openai'

/**
 * Test endpoint to test AI criteria calls without running full RSS processing
 * 
 * Usage:
 * POST /api/debug/test-ai-criteria
 * Body: { criterion: 1, title: "...", description: "...", content: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { criterion = 1, publication_id, title = 'Test Article Title', description = 'Test description', content = 'Test article content here...' } = body

    if (!publication_id) {
      return NextResponse.json({
        success: false,
        error: 'publication_id is required in request body'
      }, { status: 400 })
    }

    const promptKey = `ai_prompt_criteria_${criterion}`

    console.log(`[TEST] Testing AI call for ${promptKey}`)
    console.log(`[TEST] Input:`, { title, description, contentLength: content?.length || 0 })

    try {
      const result = await callAIWithPrompt(promptKey, publication_id, {
        title,
        description: description || '',
        content: content || ''
      })

      console.log(`[TEST] AI call succeeded`)
      console.log(`[TEST] Result type:`, typeof result)
      console.log(`[TEST] Result keys:`, result ? Object.keys(result) : 'null/undefined')
      console.log(`[TEST] Full result:`, JSON.stringify(result, null, 2))

      // Validate result structure
      const score = result?.score
      const reason = result?.reason

      const validation = {
        hasResult: !!result,
        isObject: typeof result === 'object' && result !== null,
        hasScore: typeof score !== 'undefined',
        scoreType: typeof score,
        scoreValid: typeof score === 'number' && score >= 0 && score <= 10,
        hasReason: typeof reason !== 'undefined',
        reasonType: typeof reason
      }

      return NextResponse.json({
        success: true,
        promptKey,
        input: { title, description, contentLength: content?.length || 0 },
        result,
        validation,
        parsed: {
          score,
          reason
        }
      })

    } catch (error) {
      console.error(`[TEST] AI call failed:`, error)
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        promptKey,
        input: { title, description, contentLength: content?.length || 0 }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[TEST] Request processing failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

/**
 * GET endpoint with sample data for quick testing
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const criterion = parseInt(searchParams.get('criterion') || '1')
  const publication_id = searchParams.get('publication_id')

  if (!publication_id) {
    return NextResponse.json({
      success: false,
      error: 'publication_id query parameter is required'
    }, { status: 400 })
  }

  const sampleData = {
    title: 'St. Cloud State University Launches New AI Research Initiative',
    description: 'The university announces a groundbreaking program to study artificial intelligence applications in education.',
    content: 'St. Cloud State University has launched a new research initiative focused on artificial intelligence. The program will bring together faculty from computer science, education, and business departments to explore how AI can transform learning experiences. Local businesses and community partners are also involved, providing real-world applications and funding opportunities. The initiative aims to position St. Cloud as a regional leader in AI research and education.'
  }

  try {
    const promptKey = `ai_prompt_criteria_${criterion}`

    console.log(`[TEST] Testing AI call for ${promptKey} (GET request)`)
    console.log(`[TEST] Using sample data:`, sampleData)

    const result = await callAIWithPrompt(promptKey, publication_id, {
      title: sampleData.title,
      description: sampleData.description || '',
      content: sampleData.content || ''
    })

    console.log(`[TEST] AI call succeeded`)
    console.log(`[TEST] Result:`, JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      promptKey,
      input: sampleData,
      result,
      parsed: {
        score: result?.score,
        reason: result?.reason
      }
    })

  } catch (error) {
    console.error(`[TEST] AI call failed:`, error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      promptKey: `ai_prompt_criteria_${criterion}`,
      input: sampleData
    }, { status: 500 })
  }
}

