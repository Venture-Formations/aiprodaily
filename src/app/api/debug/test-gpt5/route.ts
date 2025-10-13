import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🤖 Testing GPT-5 directly...')

    const testPrompt = "Respond with exactly: GPT-5 is working"

    try {
      console.log('Making direct GPT-5 API call...')
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [{ role: 'user', content: testPrompt }],
        max_completion_tokens: 50, // GPT-5 uses max_completion_tokens instead of max_tokens
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      console.log('GPT-5 direct test successful:', content)

      return NextResponse.json({
        success: true,
        model: 'gpt-5',
        response: content,
        message: 'GPT-5 is available and working',
        usage: response.usage
      })
    } catch (openaiError: any) {
      console.error('GPT-5 direct test failed:', openaiError)

      return NextResponse.json({
        success: false,
        model: 'gpt-5',
        error: openaiError?.message || 'Unknown OpenAI error',
        error_type: openaiError?.type || 'unknown',
        error_code: openaiError?.code || 'unknown',
        message: 'GPT-5 test failed - see error details'
      })
    }

  } catch (error) {
    console.error('GPT-5 debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}