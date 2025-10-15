import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * List all AI prompts in the database
 */
export async function GET(request: NextRequest) {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, description')
      .like('key', 'ai_prompt%')
      .order('key')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      count: prompts?.length || 0,
      prompts: prompts || []
    })

  } catch (error: any) {
    console.error('List error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
