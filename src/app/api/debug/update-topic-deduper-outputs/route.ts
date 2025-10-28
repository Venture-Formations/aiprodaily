import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Update the topic deduper expected outputs to match what the code actually uses
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        expected_outputs: {
          groups: 'array',
          unique_articles: 'array'
        }
      })
      .eq('key', 'ai_prompt_topic_deduper')

    if (error) {
      throw error
    }

    // Verify the update
    const { data: updated, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('key, expected_outputs')
      .eq('key', 'ai_prompt_topic_deduper')
      .single()

    if (fetchError) {
      throw fetchError
    }

    return NextResponse.json({
      success: true,
      message: 'Topic Deduplicator expected outputs updated successfully',
      updated_expected_outputs: updated?.expected_outputs,
      note: 'Simplified structure for test result parsing. Both "groups" and "unique_articles" will display in test results modal.'
    })

  } catch (error: any) {
    console.error('Error updating topic deduper expected outputs:', error)
    return NextResponse.json({
      error: 'Failed to update topic deduper expected outputs',
      details: error.message
    }, { status: 500 })
  }
}
