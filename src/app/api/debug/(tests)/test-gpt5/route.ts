import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-gpt5' },
  async ({ logger }) => {
    logger.info('Testing GPT-5 directly...')

    const testPrompt = "Respond with exactly: GPT-5 is working"

    try {
      logger.info('Making direct GPT-5 API call using Responses API...')
      const response = await (openai as any).responses.create({
        model: 'gpt-5',
        input: [{ role: 'user', content: testPrompt }],
        max_tokens: 50,
        temperature: 0.1,
      })

      const content = response.output_text ?? response.output?.[0]?.content?.[0]?.text ?? ""
      logger.info({ content }, 'GPT-5 direct test successful')

      return NextResponse.json({
        success: true,
        model: 'gpt-5',
        response: content,
        message: 'GPT-5 is available and working',
        usage: response.usage
      })
    } catch (openaiError: any) {
      logger.error({ err: openaiError }, 'GPT-5 direct test failed')

      return NextResponse.json({
        success: false,
        model: 'gpt-5',
        error: openaiError?.message || 'Unknown OpenAI error',
        error_type: openaiError?.type || 'unknown',
        error_code: openaiError?.code || 'unknown',
        message: 'GPT-5 test failed - see error details'
      })
    }
  }
)
