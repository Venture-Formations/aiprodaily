import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { openai, AI_PROMPTS } from '@/lib/openai'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing AI analysis...')

    // Get the most recent image from database
    const { data: images, error: fetchError } = await supabaseAdmin
      .from('images')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError || !images || images.length === 0) {
      return NextResponse.json({
        error: 'No images found in database',
        details: fetchError
      }, { status: 404 })
    }

    const image = images[0]
    console.log('Testing with image:', {
      id: image.id,
      object_key: image.object_key,
      cdn_url: image.cdn_url
    })

    // Test if image URL is accessible
    try {
      const urlTest = await fetch(image.cdn_url, { method: 'HEAD' })
      console.log('CDN URL test:', urlTest.status, urlTest.statusText)
    } catch (urlError) {
      console.error('CDN URL test failed:', urlError)
      return NextResponse.json({
        error: 'Image CDN URL not accessible',
        image_id: image.id,
        cdn_url: image.cdn_url,
        details: urlError instanceof Error ? urlError.message : urlError
      }, { status: 500 })
    }

    // Test OpenAI Vision API
    try {
      console.log('Calling OpenAI Vision API...')
      const imageAnalyzerPrompt = await AI_PROMPTS.imageAnalyzer()
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: imageAnalyzerPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: image.cdn_url
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })

      const content = response.choices[0]?.message?.content
      console.log('OpenAI response:', content)

      if (!content) {
        throw new Error('No response from OpenAI Vision')
      }

      // Try to parse the response
      let analysisResult
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0])
        } else {
          analysisResult = JSON.parse(content.trim())
        }
      } catch (parseError) {
        return NextResponse.json({
          error: 'Failed to parse AI response',
          raw_response: content,
          parse_error: parseError instanceof Error ? parseError.message : parseError
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        image_id: image.id,
        cdn_url: image.cdn_url,
        openai_response: content,
        parsed_result: analysisResult,
        message: 'AI analysis test completed successfully'
      })

    } catch (aiError) {
      console.error('OpenAI API error:', aiError)
      return NextResponse.json({
        error: 'OpenAI Vision API failed',
        image_id: image.id,
        cdn_url: image.cdn_url,
        details: aiError instanceof Error ? aiError.message : aiError
      }, { status: 500 })
    }

  } catch (error) {
    console.error('AI analysis test error:', error)
    return NextResponse.json({
      error: 'AI analysis test failed',
      details: error instanceof Error ? error.message : error
    }, { status: 500 })
  }
}