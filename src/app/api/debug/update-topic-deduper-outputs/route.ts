import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Update the topic deduper expected outputs to match what the code actually uses
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        expected_outputs: {
          groups: {
            type: 'array',
            items: {
              topic_signature: 'string',
              primary_article_index: 'integer',
              duplicate_indices: 'array',
              similarity_explanation: 'string'
            }
          }
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
      note: 'Removed unused "unique_articles" field. Only "groups" array is used by the code.'
    })

  } catch (error: any) {
    console.error('Error updating topic deduper expected outputs:', error)
    return NextResponse.json({
      error: 'Failed to update topic deduper expected outputs',
      details: error.message
    }, { status: 500 })
  }
}
