import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Deleting outdated ai_prompt_newsletter_writer from database...')

    const { error } = await supabaseAdmin
      .from('app_settings')
      .delete()
      .eq('key', 'ai_prompt_newsletter_writer')

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Deleted ai_prompt_newsletter_writer - will now use code fallback'
    })

  } catch (error) {
    console.error('Delete prompt error:', error)
    return NextResponse.json({
      error: 'Failed to delete prompt',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
