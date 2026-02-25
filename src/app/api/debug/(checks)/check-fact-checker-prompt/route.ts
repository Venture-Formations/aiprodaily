import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-fact-checker-prompt' },
  async () => {
    // Fetch fact checker prompt from database
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, description')
      .eq('key', 'ai_prompt_fact_checker')
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Prompt not found in database',
        details: error.message,
        fallback_used: true
      })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        message: 'No fact checker prompt in database',
        fallback_used: true
      })
    }

    // Check for placeholders
    const hasNewsletterPlaceholder = data.value.includes('{{newsletterContent}}')
    const hasOriginalPlaceholder = data.value.includes('{{originalContent}}')

    // Try replacing placeholders with sample content
    const sampleNewsletter = 'TEST NEWSLETTER CONTENT: This is a sample article about local news.'
    const sampleOriginal = 'TEST ORIGINAL CONTENT: This is the original source material for the article.'

    const processedPrompt = data.value
      .replace(/\{\{newsletterContent\}\}/g, sampleNewsletter)
      .replace(/\{\{originalContent\}\}/g, sampleOriginal.substring(0, 2000))

    return NextResponse.json({
      success: true,
      prompt_info: {
        key: data.key,
        description: data.description,
        length: data.value?.length || 0,
        has_newsletter_placeholder: hasNewsletterPlaceholder,
        has_original_placeholder: hasOriginalPlaceholder,
        preview: data.value.substring(0, 500) + '...',
        full_prompt: data.value,
        sample_processed_preview: processedPrompt.substring(0, 800) + '...'
      }
    })
  }
)
