import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Deleting outdated AI prompts from database...')

    // Delete contentEvaluator - has wrong scale (1-10 instead of 1-20)
    const { error: evalError } = await supabaseAdmin
      .from('app_settings')
      .delete()
      .eq('key', 'ai_prompt_content_evaluator')

    if (evalError) {
      console.error('Error deleting contentEvaluator:', evalError)
    } else {
      console.log('✓ Deleted ai_prompt_content_evaluator')
    }

    // Delete newsletterWriter - already deleted but check again
    const { error: writerError } = await supabaseAdmin
      .from('app_settings')
      .delete()
      .eq('key', 'ai_prompt_newsletter_writer')

    if (writerError) {
      console.error('Error deleting newsletterWriter:', writerError)
    } else {
      console.log('✓ Deleted ai_prompt_newsletter_writer (if existed)')
    }

    return NextResponse.json({
      success: true,
      message: 'Deleted outdated prompts - system will now use correct code fallbacks with 1-20 interest scale and proper JSON formats'
    })

  } catch (error) {
    console.error('Fix prompts error:', error)
    return NextResponse.json({
      error: 'Failed to fix prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
