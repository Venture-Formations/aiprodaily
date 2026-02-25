import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-multi-criteria' },
  async ({ logger }) => {
  try {
    console.log('Testing multi-criteria evaluation system...')

    // Fetch criteria configuration
    const { data: criteriaConfig, error: configError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.eq.criteria_enabled_count,key.like.criteria_%_name,key.like.criteria_%_weight')

    if (configError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch criteria configuration',
        details: configError
      }, { status: 500 })
    }

    console.log('Criteria config from database:', criteriaConfig)

    // Parse criteria configuration
    const enabledCountSetting = criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
    const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

    console.log(`Enabled count: ${enabledCount}`)

    // Collect enabled criteria with their weights
    const criteria: Array<{ number: number; name: string; weight: number }> = []
    for (let i = 1; i <= enabledCount; i++) {
      const nameSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_name`)
      const weightSetting = criteriaConfig?.find(s => s.key === `criteria_${i}_weight`)

      criteria.push({
        number: i,
        name: nameSetting?.value || `Criteria ${i}`,
        weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
      })
    }

    console.log('Parsed criteria:', criteria)

    // Test post data
    const testPost = {
      title: 'St. Cloud State University Announces New Scholarship Program',
      description: 'SCSU launches $500K scholarship initiative to support local students pursuing STEM degrees.',
      content: 'St. Cloud State University announced today a major new scholarship program aimed at increasing access to higher education for local students. The initiative, funded by a partnership between the university and several local businesses, will provide $500,000 in scholarship funding over the next five years.'
    }

    console.log('Test post:', testPost)

    // Test each criterion evaluation
    const results: any[] = []

    for (const criterion of criteria) {
      try {
        console.log(`\n=== Testing Criterion ${criterion.number}: ${criterion.name} (weight: ${criterion.weight}) ===`)

        // Get the evaluator function
        const evaluatorKey = `criteria${criterion.number}Evaluator` as keyof typeof AI_PROMPTS
        console.log(`Looking for evaluator: ${evaluatorKey}`)

        const evaluator = AI_PROMPTS[evaluatorKey]
        console.log(`Evaluator type: ${typeof evaluator}`)

        if (typeof evaluator !== 'function') {
          results.push({
            criterion: criterion.number,
            name: criterion.name,
            error: 'Evaluator not found or not a function',
            evaluatorType: typeof evaluator
          })
          continue
        }

        // Call the evaluator
        const evaluatorFn = evaluator as (post: { title: string; description: string; content?: string }) => Promise<string>
        console.log('Calling evaluator function...')

        const prompt = await evaluatorFn(testPost)
        console.log(`Prompt generated (length: ${prompt.length})`)
        console.log('Prompt preview:', prompt.substring(0, 200))

        // Call OpenAI
        console.log('Calling OpenAI...')
        const aiResult = await callOpenAI(prompt)
        console.log('AI Result:', aiResult)

        // Parse the result
        let score: number
        let reason: string

        if (aiResult.raw && typeof aiResult.raw === 'string') {
          try {
            const parsed = JSON.parse(aiResult.raw)
            score = parsed.score
            reason = parsed.reason || ''
          } catch (parseError) {
            console.error(`Failed to parse criterion ${criterion.number} response:`, aiResult.raw)
            results.push({
              criterion: criterion.number,
              name: criterion.name,
              error: 'Failed to parse AI response',
              rawResponse: aiResult.raw
            })
            continue
          }
        } else if (typeof aiResult.score === 'number') {
          score = aiResult.score
          reason = aiResult.reason || ''
        } else {
          results.push({
            criterion: criterion.number,
            name: criterion.name,
            error: 'Invalid AI response format',
            aiResult
          })
          continue
        }

        console.log(`Score: ${score}, Reason: ${reason}`)

        results.push({
          criterion: criterion.number,
          name: criterion.name,
          weight: criterion.weight,
          score,
          reason,
          success: true
        })

      } catch (error) {
        console.error(`Error testing criterion ${criterion.number}:`, error)
        results.push({
          criterion: criterion.number,
          name: criterion.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    }

    // Calculate weighted total
    let totalWeightedScore = 0
    let totalWeight = 0

    results.filter(r => r.success).forEach(r => {
      totalWeightedScore += r.score * r.weight
      totalWeight += r.weight
    })

    const maxPossibleScore = totalWeight * 10
    const normalizedScore = totalWeight > 0 ? (totalWeightedScore / maxPossibleScore) * 100 : 0

    return NextResponse.json({
      success: true,
      testPost,
      enabledCount,
      criteria,
      results,
      summary: {
        totalWeightedScore,
        maxPossibleScore,
        normalizedScore: normalizedScore.toFixed(2),
        successfulEvaluations: results.filter(r => r.success).length,
        failedEvaluations: results.filter(r => !r.success).length
      }
    })

  } catch (error) {
    console.error('Test multi-criteria error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
  }
)
