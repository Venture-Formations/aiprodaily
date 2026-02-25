import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/update-subject-line-description' },
  async ({ logger }) => {
  try {
    // Update the subject line generator description
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        description: 'Content Generation - Subject Line Generator: AI prompt for generating newsletter subject lines (use {{top_article}} placeholder)'
      })
      .eq('key', 'ai_prompt_subject_line')

    if (error) {
      throw error
    }

    // Verify the update
    const { data: updated } = await supabaseAdmin
      .from('app_settings')
      .select('key, description')
      .eq('key', 'ai_prompt_subject_line')
      .single()

    return NextResponse.json({
      success: true,
      message: 'Subject line description updated successfully',
      updated_description: updated?.description
    })

  } catch (error: any) {
    console.error('Error updating subject line description:', error)
    return NextResponse.json({
      error: 'Failed to update subject line description',
      details: error.message
    }, { status: 500 })
  }
  }
)
