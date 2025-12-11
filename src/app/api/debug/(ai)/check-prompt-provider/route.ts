import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const promptKey = searchParams.get('key') || 'ai_prompt_primary_article_title'
    const publicationSlug = searchParams.get('publication') // Optional publication slug

    // Get publication ID from slug if provided
    let publicationId: string | null = null
    if (publicationSlug) {
      const { data: pub } = await supabaseAdmin
        .from('publications')
        .select('id, name')
        .eq('slug', publicationSlug)
        .single()

      if (pub) {
        publicationId = pub.id
      }
    }

    // If no publication specified, get the active one
    if (!publicationId) {
      const { data: activePub } = await supabaseAdmin
        .from('publications')
        .select('id, name, slug')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (activePub) {
        publicationId = activePub.id
      }
    }

    if (!publicationId) {
      return NextResponse.json({ error: 'No publication found' }, { status: 404 })
    }

    // Check publication_settings first (this is what getPromptJSON does)
    const { data: pubSetting, error: pubError } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId)
      .eq('key', promptKey)
      .single()

    // Check app_settings as fallback
    const { data: appSetting, error: appError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, ai_provider')
      .eq('key', promptKey)
      .single()

    // Analyze the prompt
    const analyzePrompt = (value: any, source: string) => {
      if (!value) return { source, exists: false }

      let parsed: any
      try {
        parsed = typeof value === 'string' ? JSON.parse(value) : value
      } catch (e) {
        return {
          source,
          exists: true,
          error: 'Failed to parse JSON',
          rawValue: typeof value === 'string' ? value.substring(0, 200) : 'Not a string'
        }
      }

      const model = parsed?.model || ''
      const modelLower = model.toLowerCase()
      const detectedProvider =
        modelLower.includes('claude') ||
        modelLower.includes('sonnet') ||
        modelLower.includes('opus') ||
        modelLower.includes('haiku')
          ? 'claude'
          : 'openai'

      return {
        source,
        exists: true,
        model,
        detectedProvider,
        hasMessages: !!parsed.messages || !!parsed.input,
        messageCount: (parsed.messages || parsed.input || []).length,
        temperature: parsed.temperature,
        maxTokens: parsed.max_tokens,
        topP: parsed.top_p,
        // Show first 300 chars of first message content
        firstMessagePreview: (parsed.messages || parsed.input)?.[0]?.content?.substring(0, 300)
      }
    }

    const pubAnalysis = pubSetting ? analyzePrompt(pubSetting.value, 'publication_settings') : { source: 'publication_settings', exists: false }
    const appAnalysis = appSetting ? analyzePrompt(appSetting.value, 'app_settings') : { source: 'app_settings', exists: false }

    // Determine which source will be used (same logic as getPromptJSON)
    const effectiveSource = pubSetting ? 'publication_settings' : (appSetting ? 'app_settings' : 'none')
    const effectiveAnalysis = pubSetting ? pubAnalysis : appAnalysis

    return NextResponse.json({
      promptKey,
      publicationId,
      effectiveSource,
      effectiveProvider: effectiveAnalysis.exists ? effectiveAnalysis.detectedProvider : 'unknown',
      publication_settings: pubAnalysis,
      app_settings: {
        ...appAnalysis,
        storedAiProvider: appSetting?.ai_provider || null,
        note: 'ai_provider column is legacy - model name detection is used instead'
      },
      explanation: effectiveSource === 'publication_settings'
        ? `Using publication_settings. Provider auto-detected from model "${effectiveAnalysis.model}" as "${effectiveAnalysis.detectedProvider}"`
        : effectiveSource === 'app_settings'
        ? `Falling back to app_settings. Provider auto-detected from model "${effectiveAnalysis.model}" as "${effectiveAnalysis.detectedProvider}"`
        : 'No prompt found in either table!'
    })

  } catch (error) {
    console.error('Error checking prompt provider:', error)
    return NextResponse.json({
      error: 'Failed to check prompt provider',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
