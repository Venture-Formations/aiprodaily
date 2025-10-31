import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check what's actually stored in the database for a prompt
 * 
 * GET /api/debug/check-prompt-value?key=ai_prompt_criteria_1
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key') || 'ai_prompt_criteria_1'

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, ai_provider, description, updated_at, created_at')
      .eq('key', key)
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.code
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: `Prompt ${key} not found in database`
      }, { status: 404 })
    }

    // Analyze the value
    let valueType: string = typeof data.value
    let isString = typeof data.value === 'string'
    let isObject = typeof data.value === 'object' && data.value !== null
    let parsedValue: any = null
    let parseError: string | null = null
    let hasMessages = false
    let messagesIsArray = false

    if (isString) {
      try {
        parsedValue = JSON.parse(data.value)
        valueType = 'string (JSON)'
      } catch (e) {
        parseError = e instanceof Error ? e.message : 'Parse failed'
        valueType = 'string (not JSON)'
      }
    } else if (isObject) {
      parsedValue = data.value
      valueType = 'object (JSONB)'
    }

    if (parsedValue) {
      hasMessages = 'messages' in parsedValue
      messagesIsArray = Array.isArray(parsedValue.messages)
    }

    // Get first 500 chars of value for preview
    const valuePreview = isString 
      ? data.value.substring(0, 500) 
      : JSON.stringify(data.value).substring(0, 500)

    return NextResponse.json({
      success: true,
      key,
      metadata: {
        ai_provider: data.ai_provider || 'openai',
        description: data.description || '',
        updated_at: data.updated_at,
        created_at: data.created_at
      },
      valueAnalysis: {
        valueType,
        isString,
        isObject,
        valueLength: isString ? data.value.length : JSON.stringify(data.value).length,
        valuePreview: valuePreview + (valuePreview.length >= 500 ? '...' : ''),
        parseError,
        hasMessages,
        messagesIsArray,
        messagesLength: parsedValue?.messages?.length || 0
      },
      rawValue: data.value, // Full value for inspection
      parsedValue: parsedValue, // Parsed value if successful
      validation: {
        isValidJSON: !parseError && parsedValue !== null,
        hasMessagesArray: hasMessages && messagesIsArray,
        isValidStructure: !parseError && hasMessages && messagesIsArray
      },
      error: !parseError && hasMessages && messagesIsArray 
        ? null 
        : `Prompt is ${parseError ? 'not valid JSON' : !hasMessages ? 'missing messages property' : !messagesIsArray ? 'has messages but it\'s not an array' : 'invalid'}`
    })

  } catch (error) {
    console.error('[DEBUG] Error checking prompt value:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

