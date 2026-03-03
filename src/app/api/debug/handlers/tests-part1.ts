import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AdScheduler } from '@/lib/ad-scheduler'
import { AppSelector } from '@/lib/app-selector'
import { openai, callOpenAI, callAIWithPrompt } from '@/lib/openai'
import { AI_PROMPTS } from '@/lib/openai/prompt-loaders'
import { MailerLiteService } from '@/lib/mailerlite'
import { SupabaseImageStorage } from '@/lib/supabase-image-storage'
import { GoogleVisionService } from '@/lib/google-vision'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { AIApplication } from '@/types/database'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

// ─── test-ai-prompts helpers ───

// Initialize AI clients for test-ai-prompts
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Helper function to inject post data into JSON recursively
function injectPostData(obj: any, post: any): any {
  if (typeof obj === 'string') {
    if (!post) return obj
    return obj
      .replace(/\{\{title\}\}/g, post.title || '')
      .replace(/\{\{description\}\}/g, post.description || 'No description available')
      .replace(/\{\{content\}\}/g, post.content || post.full_article_text || 'No content available')
      .replace(/\{\{headline\}\}/g, post.title || post.headline || '')
      .replace(/\{\{url\}\}/g, post.source_url || '')
      .replace(/\{\{source_url\}\}/g, post.source_url || '')
      .replace(/\{\{newsletter_content\}\}/g, post.newsletter_content || '')
      .replace(/\{\{original_content\}\}/g, post.original_content || '')
      .replace(/\{\{articles\}\}/g, post.articles || '')
      .replace(/\{\{posts\}\}/g, post.posts || '')
      .replace(/\{\{venue\}\}/g, post.venue || '')
  }
  if (Array.isArray(obj)) {
    return obj.map(item => injectPostData(item, post))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const key in obj) {
      result[key] = injectPostData(obj[key], post)
    }
    return result
  }
  return obj
}

// Helper to call AI provider (OpenAI or Claude)
async function callAIProvider(
  promptJson: any,
  provider: 'openai' | 'claude'
): Promise<{ content: any, fullResponse: any }> {
  if (provider === 'openai') {
    const apiRequest = { ...promptJson }

    if (apiRequest.messages) {
      apiRequest.input = apiRequest.messages
      delete apiRequest.messages
    }

    const completion = await (openaiClient as any).responses.create(apiRequest)

    const outputArray = completion.output?.[0]?.content
    const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
    const textItem = outputArray?.find((c: any) => c.type === "text")

    let rawResponse =
      jsonSchemaItem?.json ??
      jsonSchemaItem?.input_json ??
      completion.output?.[0]?.content?.[0]?.json ??
      completion.output?.[0]?.content?.[0]?.input_json ??
      textItem?.text ??
      completion.output?.[0]?.content?.[0]?.text ??
      completion.output_text ??
      completion.choices?.[0]?.message?.content ??
      'No response'

    let content: any = rawResponse
    if (typeof rawResponse === 'string') {
      try {
        content = JSON.parse(rawResponse)
      } catch {
        content = rawResponse
      }
    }

    return {
      content,
      fullResponse: completion
    }
  } else {
    const completion = await anthropic.messages.create(promptJson)

    const textContent = completion.content.find(c => c.type === 'text')
    let content = textContent && 'text' in textContent ? textContent.text : 'No response'

    try {
      content = JSON.parse(content)
    } catch (e) {
      // Keep as string if not valid JSON
    }

    return {
      content,
      fullResponse: completion
    }
  }
}

// Helper to auto-detect provider from model name
function detectProviderFromModel(model: string): 'openai' | 'claude' {
  const modelLower = (model || '').toLowerCase()
  if (modelLower.includes('claude') || modelLower.includes('sonnet') || modelLower.includes('opus') || modelLower.includes('haiku')) {
    return 'claude'
  }
  return 'openai'
}

// Helper to load prompt JSON (from custom content or database) and get provider
async function loadPromptJSON(
  promptKey: string | null,
  customPromptContent: string | null,
  overrideProvider?: 'openai' | 'claude' | null,
  publicationId?: string | null
): Promise<{ promptJson: any, provider: 'openai' | 'claude' }> {
  let promptJson: any
  let provider: 'openai' | 'claude' = 'openai'

  if (customPromptContent) {
    promptJson = JSON.parse(customPromptContent)

    if (overrideProvider) {
      provider = overrideProvider
    } else {
      provider = detectProviderFromModel(promptJson.model)
      console.log(`[Test] Auto-detected provider from model "${promptJson.model}": ${provider}`)
    }
  } else if (promptKey) {
    let data: any = null
    let source = 'unknown'

    if (publicationId) {
      let pubUuid = publicationId
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicationId)
      if (!isUuid) {
        const { data: pub } = await supabaseAdmin
          .from('publications')
          .select('id')
          .eq('slug', publicationId)
          .single()
        if (pub) pubUuid = pub.id
      }

      const { data: pubData } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', pubUuid)
        .eq('key', promptKey)
        .single()

      if (pubData) {
        data = pubData
        source = 'publication_settings'
      }
    }

    if (!data) {
      const { data: appData, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', promptKey)
        .single()

      if (error || !appData) {
        throw new Error(`Failed to fetch prompt: ${promptKey} - ${error?.message || 'No data returned'}`)
      }
      data = appData
      source = 'app_settings'
    }

    promptJson = typeof data.value === 'string' ? JSON.parse(data.value) : data.value

    if (overrideProvider) {
      provider = overrideProvider
    } else {
      provider = detectProviderFromModel(promptJson.model)
      console.log(`[Test] Loaded from ${source}, auto-detected provider from model "${promptJson.model}": ${provider}`)
    }
  } else {
    throw new Error('Either promptKey or promptContent must be provided')
  }

  return { promptJson, provider }
}

// ─── test-affiliate-selection helper ───

async function simulateAppSelection(issueId: string, newsletterId: string): Promise<AIApplication[]> {
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')

  const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])
  const totalApps = settingsMap.get('ai_apps_per_newsletter') || 6
  const affiliateCooldownDays = settingsMap.get('affiliate_cooldown_days') || 7

  const { data: allApps } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', newsletterId)
    .eq('is_active', true)

  if (!allApps || allApps.length === 0) return []

  const eligibleApps = allApps.filter(app => {
    if (!app.is_affiliate) return true

    if (!app.last_used_date) return true

    const daysSinceLastUsed = Math.floor(
      (Date.now() - new Date(app.last_used_date).getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceLastUsed >= affiliateCooldownDays
  })

  const weightedPool: AIApplication[] = []
  for (const app of eligibleApps) {
    if (app.is_affiliate) {
      weightedPool.push(app, app, app)
    } else {
      weightedPool.push(app)
    }
  }

  const selected: AIApplication[] = []
  const selectedIds = new Set<string>()

  while (selected.length < totalApps && weightedPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * weightedPool.length)
    const selectedApp = weightedPool[randomIndex]

    if (!selectedIds.has(selectedApp.id)) {
      selected.push(selectedApp)
      selectedIds.add(selectedApp.id)
    }

    for (let i = weightedPool.length - 1; i >= 0; i--) {
      if (weightedPool[i].id === selectedApp.id) {
        weightedPool.splice(i, 1)
      }
    }
  }

  return selected
}

// ─── test-fallback-search helpers ───

interface SearchResult {
  source_url: string
  source_name: string
  title?: string
  creator?: string
  license_info?: string
  similarity_score?: number
  method: string
}

async function testUrlPatternMethod(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  try {
    const url = new URL(imageUrl)
    const domain = url.hostname.toLowerCase()

    if (domain.includes('unsplash')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Unsplash',
        license_info: 'Free License (Unsplash)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })

      const photoId = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/)?.[1]
      if (photoId) {
        results.push({
          source_url: `https://unsplash.com/photos/${photoId}`,
          source_name: 'Unsplash',
          title: 'Original Unsplash Page',
          license_info: 'Free License (Unsplash)',
          similarity_score: 1.0,
          method: 'URL Pattern'
        })
      }
    } else if (domain.includes('pexels')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Pexels',
        license_info: 'Free License (Pexels)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('pixabay')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Pixabay',
        license_info: 'Free License (Pixabay)',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('shutterstock')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Shutterstock',
        license_info: 'Licensed Stock Photo',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    } else if (domain.includes('gettyimages')) {
      results.push({
        source_url: imageUrl,
        source_name: 'Getty Images',
        license_info: 'Licensed Stock Photo',
        similarity_score: 0.9,
        method: 'URL Pattern'
      })
    }

  } catch (error) {
    console.log('URL pattern detection failed:', error)
  }

  return results
}

async function testTinEyeSearch(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  const TINEYE_API_KEY = process.env.TINEYE_API_KEY
  if (!TINEYE_API_KEY) {
    throw new Error('TinEye API key not configured')
  }

  const response = await fetch('https://api.tineye.com/rest/search/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      api_key: TINEYE_API_KEY,
      image_url: imageUrl,
      sort: 'score',
      order: 'desc'
    })
  })

  if (response.ok) {
    const data = await response.json()
    if (data.results && data.results.matches) {
      for (const match of data.results.matches.slice(0, 10)) {
        results.push({
          source_url: match.backlinks[0]?.url || '',
          source_name: extractSourceName(match.backlinks[0]?.url || ''),
          similarity_score: match.score,
          title: match.backlinks[0]?.crawl_date,
          method: 'TinEye'
        })
      }
    }
  }

  return results
}

async function testSerpApiSearch(imageUrl: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  const SERPAPI_KEY = process.env.SERPAPI_KEY
  if (!SERPAPI_KEY) {
    throw new Error('SerpAPI key not configured')
  }

  const response = await fetch(`https://serpapi.com/search.json?engine=google_reverse_image&image_url=${encodeURIComponent(imageUrl)}&api_key=${SERPAPI_KEY}`)

  if (response.ok) {
    const data = await response.json()
    if (data.image_results) {
      for (const result of data.image_results.slice(0, 10)) {
        const sourceInfo = extractStockPhotoInfo(result.link, result.title)
        results.push({
          source_url: result.link,
          source_name: sourceInfo.source,
          title: result.title,
          creator: sourceInfo.creator,
          license_info: sourceInfo.license,
          similarity_score: 0.8,
          method: 'SerpAPI'
        })
      }
    }
  }

  return results
}

function extractSourceName(url: string): string {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    if (domain.includes('shutterstock')) return 'Shutterstock'
    if (domain.includes('gettyimages')) return 'Getty Images'
    if (domain.includes('unsplash')) return 'Unsplash'
    if (domain.includes('pexels')) return 'Pexels'
    if (domain.includes('pixabay')) return 'Pixabay'
    if (domain.includes('adobe')) return 'Adobe Stock'
    if (domain.includes('istock')) return 'iStock'
    return domain.replace('www.', '')
  } catch {
    return 'Unknown Source'
  }
}

function extractStockPhotoInfo(url: string, title: string) {
  const sourceName = extractSourceName(url)
  let creator = ''
  let license = ''

  const creatorMatch = title.match(/by\s+([^-|]+)/i) || title.match(/photo\s+by\s+([^-|]+)/i)
  if (creatorMatch) {
    creator = creatorMatch[1].trim()
  }

  if (['Unsplash', 'Pexels', 'Pixabay'].includes(sourceName)) {
    license = 'Free License'
  } else if (['Shutterstock', 'Getty Images', 'Adobe Stock', 'iStock'].includes(sourceName)) {
    license = 'Licensed Stock Photo'
  }

  return { source: sourceName, creator, license }
}

// ─── test-csv-parsing helper ───

function parseCSVContent(content: string): string[][] {
  const result: string[][] = []
  const lines = content.split('\n')

  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        if (inQuotes && j < line.length - 1 && line[j + 1] === '"') {
          currentField += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }

    if (inQuotes) {
      currentField += '\n'
    } else {
      currentRow.push(currentField.trim())

      if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
        result.push(currentRow)
      }

      currentRow = []
      currentField = ''
    }

    i++
  }

  if (currentRow.length > 0 || currentField.trim().length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(field => field.trim().length > 0)) {
      result.push(currentRow)
    }
  }

  return result
}

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler; maxDuration?: number }> = {

  // ─── db-test ─── (GET)
  'db-test': {
    GET: async ({ logger }) => {
      try {
        console.log('🔄 Starting database connection test...')
        console.log('⏰ Start time:', new Date().toISOString())

        // Test basic database connectivity
        console.log('1️⃣ Testing basic connection...')
        const { data: testData, error: testError } = await supabaseAdmin
          .from('events')
          .select('id, title, created_at')
          .limit(1)

        if (testError) {
          throw new Error(`Database connection failed: ${testError.message}`)
        }

        console.log('✅ Basic connection successful')
        console.log('📊 Sample event:', testData?.[0] || 'No events found')

        // Test more complex query like the sync does
        console.log('2️⃣ Testing sync-style query...')
        console.log('⏰ Complex query start:', new Date().toISOString())

        const { data: syncTestData, error: syncTestError } = await supabaseAdmin
          .from('events')
          .select('id, updated_at, event_summary')
          .eq('external_id', 'test_nonexistent_id')
          .single()

        console.log('⏰ Complex query complete:', new Date().toISOString())
        console.log('📋 Sync query result:', {
          found: !!syncTestData,
          error: syncTestError?.code,
          message: syncTestError?.message
        })

        // Test insert operation
        console.log('3️⃣ Testing insert operation...')
        console.log('⏰ Insert test start:', new Date().toISOString())

        const testEventData = {
          external_id: `test_${Date.now()}`,
          title: 'Test Event - Safe to Delete',
          description: 'This is a test event created for debugging',
          start_date: new Date().toISOString(),
          end_date: null,
          venue: 'Test Venue',
          address: 'Test Address',
          url: null,
          image_url: null,
          featured: false,
          active: true,
          raw_data: { test: true },
          updated_at: new Date().toISOString()
        }

        const { data: insertedEvent, error: insertError } = await supabaseAdmin
          .from('events')
          .insert([testEventData])
          .select()

        console.log('⏰ Insert test complete:', new Date().toISOString())

        if (insertError) {
          console.error('❌ Insert failed:', insertError)
          throw new Error(`Insert failed: ${insertError.message}`)
        }

        console.log('✅ Insert successful:', insertedEvent?.[0]?.id)

        // Test update operation
        console.log('4️⃣ Testing update operation...')
        console.log('⏰ Update test start:', new Date().toISOString())

        const { error: updateError } = await supabaseAdmin
          .from('events')
          .update({ title: 'Test Event - Updated - Safe to Delete' })
          .eq('id', insertedEvent?.[0]?.id)

        console.log('⏰ Update test complete:', new Date().toISOString())

        if (updateError) {
          console.error('❌ Update failed:', updateError)
          throw new Error(`Update failed: ${updateError.message}`)
        }

        console.log('✅ Update successful')

        // Clean up test event
        console.log('5️⃣ Cleaning up test event...')
        console.log('⏰ Cleanup start:', new Date().toISOString())

        const { error: deleteError } = await supabaseAdmin
          .from('events')
          .delete()
          .eq('id', insertedEvent?.[0]?.id)

        console.log('⏰ Cleanup complete:', new Date().toISOString())

        if (deleteError) {
          console.error('❌ Cleanup failed:', deleteError)
        } else {
          console.log('✅ Cleanup successful')
        }

        console.log('⏰ All tests complete:', new Date().toISOString())

        return NextResponse.json({
          success: true,
          message: 'All database operations completed successfully',
          tests: {
            connection: 'passed',
            complex_query: 'passed',
            insert: 'passed',
            update: 'passed',
            cleanup: deleteError ? 'failed' : 'passed'
          },
          sample_event: testData?.[0],
          test_event_id: insertedEvent?.[0]?.id,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('❌ Database test failed:', error)
        console.log('⏰ Error time:', new Date().toISOString())

        return NextResponse.json({
          error: 'Database test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
  },

  // ─── middleware-test ─── (GET)
  'middleware-test': {
    GET: async ({ request, logger }) => {
      const hostname = request.headers.get('host') || ''
      const adminDomains = ['aiprodaily.com', 'www.aiprodaily.com', 'aiprodaily.vercel.app']
      const isAdminDomain = adminDomains.includes(hostname)

      return NextResponse.json({
        success: true,
        hostname,
        isAdminDomain,
        adminDomains,
        middlewareHeader: request.headers.get('x-middleware-ran'),
        allHeaders: Object.fromEntries(request.headers.entries())
      })
    }
  },

  // ─── mobile-cookie-test ─── (GET)
  'mobile-cookie-test': {
    GET: async ({ request, logger }) => {
      try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()

        // Check for NextAuth specific cookies
        const sessionToken = cookieStore.get('next-auth.session-token') || cookieStore.get('__Secure-next-auth.session-token')
        const csrfToken = cookieStore.get('next-auth.csrf-token') || cookieStore.get('__Host-next-auth.csrf-token')

        return NextResponse.json({
          diagnosis: 'Mobile Cookie Analysis',
          cookies: {
            total: allCookies.length,
            names: allCookies.map(c => c.name),
            values: Object.fromEntries(allCookies.map(c => [c.name, c.value.substring(0, 20) + '...'])),
            nextAuth: {
              sessionToken: sessionToken ? 'FOUND' : 'MISSING',
              csrfToken: csrfToken ? 'FOUND' : 'MISSING'
            }
          },
          headers: {
            userAgent: request.headers.get('user-agent'),
            cookie: request.headers.get('cookie'),
            host: request.headers.get('host'),
            'x-forwarded-proto': request.headers.get('x-forwarded-proto')
          },
          nextSteps: sessionToken ?
            'Session token found - try /api/debug/auth-status' :
            'No session token - login may have failed. Try clearing cookies and logging in again.',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        return NextResponse.json({
          error: 'Cookie analysis failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── simple-auth-test ─── (GET)
  'simple-auth-test': {
    GET: async ({ session, logger }) => {
      // This route intentionally tests the full session object for debugging
      const complexSession = await getServerSession(authOptions)

      return NextResponse.json({
        test: 'Simple Auth Test',
        wrapperAuth: {
          hasSession: !!session,
          user: session?.user || null
        },
        complexAuth: {
          hasSession: !!complexSession,
          user: complexSession?.user || null
        },
        suggestion: 'If complex auth fails but you need login, we can temporarily simplify the auth flow',
        nextStep: 'Check Vercel logs for "SignIn callback triggered" messages',
        timestamp: new Date().toISOString()
      })
    }
  },

  // ─── test-ad-selection ─── (POST, maxDuration: 60)
  'test-ad-selection': {
    POST: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const createTest = searchParams.get('create_test') === 'true'

        let body
        try {
          body = await request.json()
        } catch {
          body = {}
        }

        let issueId = body.issue_id
        let date = body.date || new Date().toISOString().split('T')[0]

        // Create a test issue if requested
        if (createTest || !issueId) {
          console.log('[Test Ad] Creating test issue...')

          // Get newsletter ID
          const { data: newsletter } = await supabaseAdmin
            .from('publications')
            .select('id')
            .eq('slug', 'accounting')
            .single()

          if (!newsletter) {
            return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
          }

          const { data: testissue, error: createError } = await supabaseAdmin
            .from('publication_issues')
            .insert([{
              date: date,
              status: 'draft',
              publication_id: newsletter.id
            }])
            .select('id')
            .single()

          if (createError || !testissue) {
            return NextResponse.json({
              error: 'Failed to create test issue',
              details: createError
            }, { status: 500 })
          }

          issueId = testissue.id
          console.log(`[Test Ad] Created test issue: ${issueId}`)
        }

        // Get publication_id from issue
        const { data: issue } = await supabaseAdmin
          .from('publication_issues')
          .select('publication_id')
          .eq('id', issueId)
          .single()

        if (!issue) {
          return NextResponse.json({ error: 'issue not found' }, { status: 404 })
        }

        // Test ad selection
        console.log(`[Test Ad] Testing ad selection for issue: ${issueId}`)

        const selectedAd = await AdScheduler.selectAdForissue({
          issueId: issueId,
          issueDate: date,
          newsletterId: issue.publication_id
        })

        if (!selectedAd) {
          return NextResponse.json({
            success: false,
            message: 'No advertisement available',
            issue_id: issueId,
            date: date
          })
        }

        console.log(`[Test Ad] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)

        // Test ad recording
        try {
          await AdScheduler.recordAdUsage(issueId, selectedAd.id, date, issue.publication_id)
          console.log('[Test Ad] Successfully recorded ad usage')
        } catch (recordError) {
          console.error('[Test Ad] Failed to record ad usage:', recordError)
          return NextResponse.json({
            success: false,
            error: 'Failed to record ad usage',
            details: recordError,
            selected_ad: {
              id: selectedAd.id,
              title: selectedAd.title,
              display_order: selectedAd.display_order
            },
            issue_id: issueId,
            publication_id: issue.publication_id
          }, { status: 500 })
        }

        // Verify the ad was recorded (get most recent)
        const { data: verification, error: verifyError } = await supabaseAdmin
          .from('issue_advertisements')
          .select('*, advertisement:advertisements(*)')
          .eq('issue_id', issueId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (verifyError) {
          console.error('[Test Ad] Verification failed:', verifyError)
        }

        // Check next_ad_position was updated
        const { data: nextPosition } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('publication_id', issue.publication_id)
          .eq('key', 'next_ad_position')
          .maybeSingle()

        return NextResponse.json({
          success: true,
          message: 'Advertisement selection and recording successful',
          issue_id: issueId,
          date: date,
          selected_ad: {
            id: selectedAd.id,
            title: selectedAd.title,
            display_order: selectedAd.display_order,
            status: selectedAd.status
          },
          verification: {
            recorded: !!verification,
            error: verifyError?.message
          },
          next_ad_position: nextPosition?.value,
          test_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/accounting/campaigns/${issueId}`
        })

      } catch (error) {
        console.error('[Test Ad] Error:', error)
        return NextResponse.json({
          success: false,
          error: 'Test failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }, { status: 500 })
      }
    },
    maxDuration: 60
  },

  // ─── test-affiliate-selection ─── (GET, maxDuration: 600)
  'test-affiliate-selection': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const issueId = searchParams.get('issueId')
        const reset = searchParams.get('reset') === 'true'
        const dryRun = searchParams.get('dryRun') === 'true'

        let testissueId = issueId

        // Get newsletter ID
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('id')
          .eq('slug', 'accounting')
          .single()

        if (!newsletter) {
          return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
        }

        // If no issue ID provided, get latest draft issue or create test one
        if (!testissueId) {
          const { data: latestissue } = await supabaseAdmin
            .from('publication_issues')
            .select('id')
            .eq('publication_id', newsletter.id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (latestissue) {
            testissueId = latestissue.id
          } else {
            // Create a test issue
            const testDate = new Date().toISOString().split('T')[0]
            const { data: newissue, error } = await supabaseAdmin
              .from('publication_issues')
              .insert({
                publication_id: newsletter.id,
                date: testDate,
                status: 'draft'
              })
              .select('id')
              .single()

            if (error || !newissue) {
              return NextResponse.json({ error: 'Failed to create test issue' }, { status: 500 })
            }
            testissueId = newissue.id
          }
        }

        // Clear existing selections if reset=true
        if (reset) {
          await supabaseAdmin
            .from('issue_ai_app_selections')
            .delete()
            .eq('issue_id', testissueId)
        }

        // Get current settings
        const { data: settings } = await supabaseAdmin
          .from('app_settings')
          .select('key, value')
          .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')

        const settingsMap: Record<string, string> = {}
        settings?.forEach(s => {
          settingsMap[s.key] = s.value || '0'
        })

        // Get all active apps
        const { data: allApps } = await supabaseAdmin
          .from('ai_applications')
          .select('*')
          .eq('publication_id', newsletter.id)
          .eq('is_active', true)
          .order('app_name')

        // Run selection logic
        if (!testissueId) {
          return NextResponse.json({ error: 'Failed to get or create issue' }, { status: 500 })
        }

        let selectedApps
        if (dryRun) {
          selectedApps = await simulateAppSelection(testissueId, newsletter.id)
        } else {
          selectedApps = await AppSelector.selectAppsForissue(testissueId, newsletter.id)
        }

        // Get detailed info about all apps for comparison
        const affiliateCooldownDays = parseInt(settingsMap.affiliate_cooldown_days || '7')
        const now = new Date()

        const appDetails = allApps?.map(app => {
          const isSelected = selectedApps.some(sa => sa.id === app.id)
          const daysSinceLastUsed = app.last_used_date
            ? Math.floor((now.getTime() - new Date(app.last_used_date).getTime()) / (1000 * 60 * 60 * 24))
            : null

          const inCooldown = app.is_affiliate && app.last_used_date && daysSinceLastUsed !== null && daysSinceLastUsed < affiliateCooldownDays

          return {
            app_name: app.app_name,
            category: app.category,
            is_affiliate: app.is_affiliate,
            is_featured: app.is_featured,
            last_used_date: app.last_used_date,
            days_since_last_used: daysSinceLastUsed,
            in_cooldown: inCooldown,
            is_selected: isSelected,
            times_used: app.times_used
          }
        }) || []

        // Get selection details from database
        const { data: selections } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select('*, app:ai_applications(*)')
          .eq('issue_id', testissueId)
          .order('selection_order')

        return NextResponse.json({
          success: true,
          dry_run: dryRun,
          issue_id: testissueId,
          settings: {
            total_apps: settingsMap.ai_apps_per_newsletter || '6',
            affiliate_cooldown_days: affiliateCooldownDays,
            category_counts: {
              payroll: settingsMap.ai_apps_payroll_count || '0',
              hr: settingsMap.ai_apps_hr_count || '0',
              accounting: settingsMap.ai_apps_accounting_count || '0',
              finance: settingsMap.ai_apps_finance_count || '0',
              productivity: settingsMap.ai_apps_productivity_count || '0',
              client_mgmt: settingsMap.ai_apps_client_mgmt_count || '0',
              banking: settingsMap.ai_apps_banking_count || '0'
            }
          },
          selection_summary: {
            total_selected: selectedApps.length,
            affiliates_selected: selectedApps.filter(a => a.is_affiliate).length,
            non_affiliates_selected: selectedApps.filter(a => !a.is_affiliate).length
          },
          selected_apps: selections?.map(s => ({
            selection_order: s.selection_order,
            app_name: s.app.app_name,
            category: s.app.category,
            is_affiliate: s.app.is_affiliate,
            is_featured: s.app.is_featured,
            last_used_date: s.app.last_used_date,
            times_used: s.app.times_used
          })) || [],
          all_apps_status: appDetails
        })

      } catch (error: any) {
        console.error('Test selection error:', error)
        return NextResponse.json(
          { error: 'Test failed', details: error.message },
          { status: 500 }
        )
      }
    },
    maxDuration: 600
  },

  // ─── test-ai-analysis ─── (GET)
  'test-ai-analysis': {
    GET: async ({ logger }) => {
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
          console.log('Calling OpenAI Vision API using Responses API...')
          const imageAnalyzerPrompt = await AI_PROMPTS.imageAnalyzer()
          const response = await (openai as any).responses.create({
            model: 'gpt-4o',
            input: [
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

          // Extract content from Responses API format
          const content = response.output_text ?? response.output?.[0]?.content?.[0]?.text ?? ""
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
  },

  // ─── test-ai-criteria ─── (GET + POST)
  'test-ai-criteria': {
    POST: async ({ request, logger }) => {
      try {
        const body = await request.json()
        const { criterion = 1, publication_id, title = 'Test Article Title', description = 'Test description', content = 'Test article content here...' } = body

        if (!publication_id) {
          return NextResponse.json({
            success: false,
            error: 'publication_id is required in request body'
          }, { status: 400 })
        }

        const promptKey = `ai_prompt_criteria_${criterion}`

        console.log(`[TEST] Testing AI call for ${promptKey}`)
        console.log(`[TEST] Input:`, { title, description, contentLength: content?.length || 0 })

        try {
          const result = await callAIWithPrompt(promptKey, publication_id, {
            title,
            description: description || '',
            content: content || ''
          })

          console.log(`[TEST] AI call succeeded`)
          console.log(`[TEST] Result type:`, typeof result)
          console.log(`[TEST] Result keys:`, result ? Object.keys(result) : 'null/undefined')
          console.log(`[TEST] Full result:`, JSON.stringify(result, null, 2))

          // Validate result structure
          const score = result?.score
          const reason = result?.reason

          const validation = {
            hasResult: !!result,
            isObject: typeof result === 'object' && result !== null,
            hasScore: typeof score !== 'undefined',
            scoreType: typeof score,
            scoreValid: typeof score === 'number' && score >= 0 && score <= 10,
            hasReason: typeof reason !== 'undefined',
            reasonType: typeof reason
          }

          return NextResponse.json({
            success: true,
            promptKey,
            input: { title, description, contentLength: content?.length || 0 },
            result,
            validation,
            parsed: {
              score,
              reason
            }
          })

        } catch (error) {
          console.error(`[TEST] AI call failed:`, error)

          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            promptKey,
            input: { title, description, contentLength: content?.length || 0 }
          }, { status: 500 })
        }

      } catch (error) {
        console.error('[TEST] Request processing failed:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    },
    GET: async ({ request, logger }) => {
      const searchParams = request.nextUrl.searchParams
      const criterion = parseInt(searchParams.get('criterion') || '1')
      const publication_id = searchParams.get('publication_id')

      if (!publication_id) {
        return NextResponse.json({
          success: false,
          error: 'publication_id query parameter is required'
        }, { status: 400 })
      }

      const sampleData = {
        title: 'St. Cloud State University Launches New AI Research Initiative',
        description: 'The university announces a groundbreaking program to study artificial intelligence applications in education.',
        content: 'St. Cloud State University has launched a new research initiative focused on artificial intelligence. The program will bring together faculty from computer science, education, and business departments to explore how AI can transform learning experiences. Local businesses and community partners are also involved, providing real-world applications and funding opportunities. The initiative aims to position St. Cloud as a regional leader in AI research and education.'
      }

      try {
        const promptKey = `ai_prompt_criteria_${criterion}`

        console.log(`[TEST] Testing AI call for ${promptKey} (GET request)`)
        console.log(`[TEST] Using sample data:`, sampleData)

        const result = await callAIWithPrompt(promptKey, publication_id, {
          title: sampleData.title,
          description: sampleData.description || '',
          content: sampleData.content || ''
        })

        console.log(`[TEST] AI call succeeded`)
        console.log(`[TEST] Result:`, JSON.stringify(result, null, 2))

        return NextResponse.json({
          success: true,
          promptKey,
          input: sampleData,
          result,
          parsed: {
            score: result?.score,
            reason: result?.reason
          }
        })

      } catch (error) {
        console.error(`[TEST] AI call failed:`, error)

        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          promptKey: `ai_prompt_criteria_${criterion}`,
          input: sampleData
        }, { status: 500 })
      }
    }
  },

  // ─── test-ai-prompts ─── (GET)
  'test-ai-prompts': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const promptType = searchParams.get('type') || 'all'
        const promptKey = searchParams.get('promptKey')
        const rssPostId = searchParams.get('rssPostId')
        const customPromptContent = searchParams.get('promptContent')
        const providerParam = searchParams.get('provider') as 'openai' | 'claude' | null
        const publicationId = searchParams.get('publicationId') || searchParams.get('newsletterId')

        const results: Record<string, any> = {}

        // Fetch real RSS post data if provided
        let rssPost: any = null
        if (rssPostId) {
          const { data, error } = await supabaseAdmin
            .from('rss_posts')
            .select('*')
            .eq('id', rssPostId)
            .single()

          if (error) {
            console.error('[DEBUG] Error fetching RSS post:', error)
          } else {
            rssPost = data
            console.log('[DEBUG] Using RSS post:', rssPost.title)
          }
        }

        // Test data for each prompt type
        const testData = {
          contentEvaluator: rssPost ? {
            title: rssPost.title,
            description: rssPost.description || '',
            content: rssPost.content || rssPost.description || ''
          } : {
            title: 'St. Cloud School District Launches New STEM Program',
            description: 'The St. Cloud Area School District announced today that it will launch a comprehensive STEM education program this fall, providing students with hands-on experience in science, technology, engineering, and mathematics through partnerships with local businesses and St. Cloud State University.',
            content: 'The new program will be available to students in grades 6-12 and will include after-school clubs, summer camps, and specialized coursework. Local tech companies have pledged equipment donations and mentorship opportunities.'
          },
          newsletterWriter: rssPost ? {
            title: rssPost.title,
            description: rssPost.description || '',
            content: rssPost.content || rssPost.description || '',
            source_url: rssPost.source_url || ''
          } : {
            title: 'New Community Center Opens in Waite Park',
            description: 'Waite Park celebrated the grand opening of its new $5 million community center on Saturday, featuring a gym, meeting rooms, and senior activity spaces.',
            content: 'The 25,000 square foot facility at 715 2nd Ave S will serve as a hub for community activities, offering fitness classes, youth programs, and event rentals. Mayor Rick Miller said the center will "bring people together" and provide year-round recreational opportunities.',
            source_url: 'https://example.com/article'
          },
          subjectLineGenerator: rssPost ? {
            headline: rssPost.title,
            content: rssPost.content || rssPost.description || ''
          } : {
            headline: 'Sartell Bridge Construction Begins Monday',
            content: 'The Minnesota Department of Transportation will close the Sartell Bridge for major repairs starting Monday morning. The project is expected to last six weeks.'
          },
          eventSummarizer: rssPost ? {
            title: rssPost.title,
            description: rssPost.description || rssPost.content || '',
            venue: 'See description'
          } : {
            title: 'Summer Concert Series at Lake George',
            description: 'Join us for free outdoor concerts every Thursday evening in July! Local bands will perform a variety of music styles from 6-8 PM. Bring your lawn chairs and blankets. Food trucks will be available.',
            venue: 'Lake George Amphitheater'
          },
          roadWorkGenerator: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          imageAnalyzer: 'Image analysis requires actual image input - use the image ingest endpoint instead',
          factChecker: {
            newsletterContent: 'New tax rules for small businesses will take effect in January 2025. The IRS announced sweeping changes to deduction limits and reporting requirements that will affect firms with under 50 employees.',
            originalContent: 'The Internal Revenue Service announced today that significant changes to small business taxation will be implemented starting January 1, 2025. These changes will impact businesses with fewer than 50 employees, particularly in terms of expense deduction limits and quarterly reporting requirements. The new rules aim to simplify compliance while ensuring accurate tax collection.'
          },
          topicDeduper: [
            {
              title: 'AI Tool Revolutionizes Tax Preparation for CPAs',
              description: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy.',
              full_article_text: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy. The technology uses machine learning to analyze tax documents and identify potential deductions.'
            },
            {
              title: 'New AI Software Transforms Tax Filing Process',
              description: 'Accounting professionals are adopting AI technology that cuts tax prep time in half and boosts accuracy rates.',
              full_article_text: 'Accounting professionals are adopting AI technology that cuts tax prep time in half and boosts accuracy rates. The software automates data entry and flags potential errors before submission.'
            },
            {
              title: 'AICPA Issues New Guidelines on AI Use in Auditing',
              description: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures.',
              full_article_text: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures. The new standards address data privacy, algorithm transparency, and professional judgment requirements.'
            },
            {
              title: 'Cloud Accounting Platform Adds Real-Time Anomaly Detection',
              description: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time.',
              full_article_text: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time. The system monitors account activity and alerts users to potential fraud or data entry errors.'
            },
            {
              title: 'QuickBooks Launches AI-Powered Fraud Detection',
              description: 'The popular accounting software now includes artificial intelligence to flag suspicious transactions automatically.',
              full_article_text: 'The popular accounting software now includes artificial intelligence to flag suspicious transactions automatically. QuickBooks fraud detection monitors patterns and identifies anomalies that may indicate fraudulent activity.'
            }
          ]
        }

        // Test Content Evaluator
        if (promptType === 'all' || promptType === 'contentEvaluator') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_content_evaluator'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              title: testData.contentEvaluator.title,
              description: testData.contentEvaluator.description,
              content: testData.contentEvaluator.content,
              full_article_text: testData.contentEvaluator.content
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.contentEvaluator = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.contentEvaluator = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Newsletter Writer
        if (promptType === 'all' || promptType === 'newsletterWriter') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_newsletter_writer'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              title: testData.newsletterWriter.title,
              description: testData.newsletterWriter.description,
              content: testData.newsletterWriter.content,
              full_article_text: testData.newsletterWriter.content,
              source_url: testData.newsletterWriter.source_url
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.newsletterWriter = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.newsletterWriter = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Primary Article Title
        if (promptType === 'primaryArticleTitle') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_primary_article_title'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              title: testData.newsletterWriter.title,
              description: testData.newsletterWriter.description,
              content: testData.newsletterWriter.content,
              full_article_text: testData.newsletterWriter.content,
              source_url: testData.newsletterWriter.source_url
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.primaryArticleTitle = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.primaryArticleTitle = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Primary Article Body
        if (promptType === 'primaryArticleBody') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_primary_article_body'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'
            const postData = {
              title: testData.newsletterWriter.title,
              description: testData.newsletterWriter.description,
              content: testData.newsletterWriter.content,
              full_article_text: testData.newsletterWriter.content,
              source_url: testData.newsletterWriter.source_url,
              headline: sampleHeadline
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.primaryArticleBody = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              note: `Using headline: "${sampleHeadline}"`,
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.primaryArticleBody = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Secondary Article Title
        if (promptType === 'secondaryArticleTitle') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_secondary_article_title'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              title: testData.newsletterWriter.title,
              description: testData.newsletterWriter.description,
              content: testData.newsletterWriter.content,
              full_article_text: testData.newsletterWriter.content,
              source_url: testData.newsletterWriter.source_url
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.secondaryArticleTitle = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.secondaryArticleTitle = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Secondary Article Body
        if (promptType === 'secondaryArticleBody') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_secondary_article_body'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const sampleHeadline = rssPost?.title || 'Sample Test Headline for Article Body'
            const postData = {
              title: testData.newsletterWriter.title,
              description: testData.newsletterWriter.description,
              content: testData.newsletterWriter.content,
              full_article_text: testData.newsletterWriter.content,
              source_url: testData.newsletterWriter.source_url,
              headline: sampleHeadline
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.secondaryArticleBody = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              note: `Using headline: "${sampleHeadline}"`,
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.secondaryArticleBody = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Subject Line Generator
        if (promptType === 'all' || promptType === 'subjectLineGenerator') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_subject_line'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              headline: testData.subjectLineGenerator.headline,
              content: testData.subjectLineGenerator.content,
              full_article_text: testData.subjectLineGenerator.content
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.subjectLineGenerator = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              character_count: typeof content === 'string' ? content.length : 0,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.subjectLineGenerator = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Event Summarizer
        if (promptType === 'all' || promptType === 'eventSummarizer') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_event_summary'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              title: testData.eventSummarizer.title,
              description: testData.eventSummarizer.description,
              venue: testData.eventSummarizer.venue
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.eventSummarizer = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.eventSummarizer = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Road Work Generator - skip (requires special handling)
        if (promptType === 'all' || promptType === 'roadWorkGenerator') {
          results.roadWorkGenerator = {
            success: true,
            note: 'Road Work Generator requires special handling. Use /api/debug/test-ai-road-work to actually generate road work data.'
          }
        }

        // Image Analyzer note
        if (promptType === 'all' || promptType === 'imageAnalyzer') {
          results.imageAnalyzer = {
            success: true,
            note: 'Image analysis requires actual image input. Use POST /api/images/ingest with an image to test.'
          }
        }

        // Test Fact Checker
        if (promptType === 'all' || promptType === 'factChecker') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_fact_checker'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              newsletter_content: testData.factChecker.newsletterContent,
              original_content: testData.factChecker.originalContent
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.factChecker = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              test_data_used: {
                newsletter_length: testData.factChecker.newsletterContent.length,
                original_length: testData.factChecker.originalContent.length
              },
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.factChecker = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Welcome Section
        if (promptType === 'all' || promptType === 'welcomeSection') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_welcome_section'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            let testArticles: Array<{ headline: string; content: string }> = []
            let articlesSource = 'fallback'
            let issueDate: string | null = null

            if (publicationId) {
              let publicationUuid = publicationId

              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicationId)
              if (!isUuid) {
                const { data: publication } = await supabaseAdmin
                  .from('publications')
                  .select('id')
                  .eq('slug', publicationId)
                  .single()

                if (publication) {
                  publicationUuid = publication.id
                }
              }

              const { data: recentIssue } = await supabaseAdmin
                .from('publication_issues')
                .select('id, date')
                .eq('publication_id', publicationUuid)
                .eq('status', 'sent')
                .order('date', { ascending: false })
                .limit(1)
                .single()

              if (recentIssue) {
                const { data: articles } = await supabaseAdmin
                  .from('articles')
                  .select('headline, content')
                  .eq('issue_id', recentIssue.id)
                  .eq('is_active', true)
                  .order('rank', { ascending: true })

                if (articles && articles.length > 0) {
                  testArticles = articles
                  articlesSource = 'database'
                  issueDate = recentIssue.date
                }
              }
            }

            if (testArticles.length === 0) {
              testArticles = [
                {
                  headline: 'AI Tool Revolutionizes Tax Preparation for CPAs',
                  content: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy. The tool uses machine learning to identify deductions and flag potential issues before filing.'
                },
                {
                  headline: 'AICPA Issues New Guidelines on AI Use in Auditing',
                  content: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures, emphasizing the need for human oversight and validation of AI-generated insights.'
                },
                {
                  headline: 'Cloud Accounting Platform Adds Real-Time Anomaly Detection',
                  content: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time, alerting accountants to potential fraud or errors before they become major issues.'
                },
                {
                  headline: 'Study Shows 78% of Accounting Firms Plan AI Adoption',
                  content: 'A recent survey reveals that the majority of accounting firms are planning to adopt AI tools within the next 18 months, primarily for automation of routine tasks and enhanced data analysis.'
                },
                {
                  headline: 'New IRS Ruling Addresses AI-Generated Tax Forms',
                  content: 'The Internal Revenue Service has issued guidance on the use of AI-generated tax documents, clarifying requirements for review and validation by licensed professionals.'
                }
              ]
            }

            const postData = {
              articles: JSON.stringify(testArticles, null, 2)
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.welcomeSection = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              test_articles_count: testArticles.length,
              articles_source: articlesSource,
              issue_date: issueDate,
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.welcomeSection = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        // Test Topic Deduper
        if (promptType === 'all' || promptType === 'topicDeduper') {
          try {
            const testPromptKey = promptKey || 'ai_prompt_topic_deduper'
            const { promptJson: loadedPromptJson, provider: loadedProvider } = await loadPromptJSON(testPromptKey, customPromptContent, providerParam, publicationId)

            const postData = {
              posts: JSON.stringify(testData.topicDeduper, null, 2),
              articles: JSON.stringify(testData.topicDeduper, null, 2)
            }

            const processedJson = injectPostData(loadedPromptJson, postData)
            const { content, fullResponse } = await callAIProvider(processedJson, loadedProvider)

            results.topicDeduper = {
              success: true,
              response: content,
              fullResponse: fullResponse,
              prompt_key_used: testPromptKey,
              prompt_source: customPromptContent ? 'custom' : 'database',
              test_posts_count: testData.topicDeduper.length,
              expected_duplicates: 'Posts 0+1 (tax software), Posts 3+4 (QuickBooks fraud detection)',
              ai_provider: loadedProvider
            }
          } catch (error) {
            results.topicDeduper = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: 'AI Prompts Test Results',
          prompt_type: promptType,
          test_data: promptType === 'all' ? 'Sample data for all prompts' : testData[promptType as keyof typeof testData],
          rss_post_used: rssPost ? {
            id: rssPost.id,
            title: rssPost.title,
            source_url: rssPost.source_url
          } : null,
          results,
          usage_note: 'Add ?type=promptName to test individual prompts. Add &promptKey=KEY to test a specific prompt from database. Add &promptContent=JSON to test custom prompt. Add &provider=openai|claude to override the AI provider (useful for testing prompts with different providers). Add &rssPostId=UUID to use real RSS post data instead of sample data.',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Error testing AI prompts:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    }
  },

  // ─── test-app-selection ─── (GET)
  'test-app-selection': {
    GET: async ({ logger }) => {
      try {
        // Step 1: Check newsletters
        const { data: newsletters, error: newsletterError } = await supabaseAdmin
          .from('publications')
          .select('*')
          .eq('is_active', true)

        if (newsletterError) {
          return NextResponse.json({ error: newsletterError.message, step: 'newsletters' }, { status: 500 })
        }

        // Step 2: Check AI applications
        const { data: apps, error: appsError } = await supabaseAdmin
          .from('ai_applications')
          .select('*')
          .eq('is_active', true)

        if (appsError) {
          return NextResponse.json({ error: appsError.message, step: 'apps' }, { status: 500 })
        }

        // Step 3: Get most recent issue
        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (issueError) {
          return NextResponse.json({ error: issueError.message, step: 'issue' }, { status: 500 })
        }

        // Step 4: Check existing app selections for this issue
        const { data: existingSelections } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select('*, app:ai_applications(*)')
          .eq('issue_id', issue.id)

        // Step 5: Try selecting apps manually
        let selectionResult = null
        let selectionError = null

        if (newsletters && newsletters.length > 0) {
          const newsletter = newsletters[0]
          try {
            const selectedApps = await AppSelector.selectAppsForissue(issue.id, newsletter.id)
            selectionResult = {
              publication_id: newsletter.id,
              newsletter_name: newsletter.name,
              selected_count: selectedApps.length,
              selected_apps: selectedApps.map((app: any) => ({
                id: app.id,
                name: app.app_name,
                category: app.category
              }))
            }
          } catch (err) {
            selectionError = err instanceof Error ? err.message : 'Unknown error'
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            newsletters: {
              count: newsletters?.length || 0,
              list: newsletters?.map(n => ({ id: n.id, name: n.name, slug: n.slug, active: n.is_active }))
            },
            ai_applications: {
              total_active: apps?.length || 0,
              by_newsletter: newsletters?.map(n => ({
                newsletter: n.name,
                app_count: apps?.filter(app => app.publication_id === n.id).length || 0
              }))
            },
            latest_issue: {
              id: issue.id,
              date: issue.date,
              created_at: issue.created_at,
              existing_app_selections: existingSelections?.length || 0
            },
            manual_selection_test: selectionResult,
            selection_error: selectionError
          }
        })

      } catch (error) {
        console.error('Error in test-app-selection:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-article-generation ─── (GET)
  'test-article-generation': {
    GET: async ({ logger }) => {
      try {
        const issueId = '3c1c8063-806a-483d-a00a-0eab54d721a5'

        console.log('=== TESTING ARTICLE GENERATION ===')
        console.log('issue ID:', issueId)

        // Get the highest rated post
        const { data: posts, error: postsError } = await supabaseAdmin
          .from('rss_posts')
          .select(`
            id,
            title,
            description,
            content,
            source_url,
            post_ratings(
              total_score,
              interest_level,
              local_relevance,
              community_impact
            )
          `)
          .eq('issue_id', issueId)
          .not('post_ratings', 'is', null)
          .limit(10)

        if (postsError || !posts || posts.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No rated posts found',
            details: postsError?.message
          }, { status: 404 })
        }

        // Find post with highest rating
        const sortedPosts = posts
          .filter((p: any) => p.post_ratings && p.post_ratings.length > 0)
          .sort((a: any, b: any) => {
            const scoreA = a.post_ratings[0]?.total_score || 0
            const scoreB = b.post_ratings[0]?.total_score || 0
            return scoreB - scoreA
          })

        if (sortedPosts.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No posts with ratings found'
          }, { status: 404 })
        }

        const post = sortedPosts[0] as any
        console.log('Testing with post:', {
          id: post.id,
          title: post.title.substring(0, 100),
          rating: post.post_ratings?.[0]
        })

        // Generate newsletter content
        console.log('Generating newsletter content...')
        const newsletterPrompt = await AI_PROMPTS.newsletterWriter({
          title: post.title,
          description: post.description || '',
          content: post.content || '',
          source_url: post.source_url || ''
        })

        console.log('Prompt length:', newsletterPrompt.length)
        console.log('Calling OpenAI...')

        const newsletterResult = await callOpenAI(newsletterPrompt, 500, 0.7)

        console.log('AI Response type:', typeof newsletterResult)
        console.log('AI Response:', newsletterResult)

        // Check if response has required fields
        if (!newsletterResult.headline || !newsletterResult.content || !newsletterResult.word_count) {
          return NextResponse.json({
            success: false,
            error: 'Invalid newsletter content response - missing required fields',
            response_type: typeof newsletterResult,
            has_headline: !!newsletterResult.headline,
            has_content: !!newsletterResult.content,
            has_word_count: !!newsletterResult.word_count,
            response_keys: Object.keys(newsletterResult),
            response: newsletterResult
          }, { status: 500 })
        }

        console.log('Newsletter content generated successfully:', {
          headline: newsletterResult.headline,
          content_length: newsletterResult.content.length,
          word_count: newsletterResult.word_count
        })

        // Fact-check the content
        console.log('Fact-checking content...')
        const factCheckPrompt = await AI_PROMPTS.factChecker(
          JSON.stringify(newsletterResult),
          post.content || post.description || post.title
        )

        const factCheckResult = await callOpenAI(factCheckPrompt, 300, 0.3)

        console.log('Fact-check result:', factCheckResult)

        if (typeof factCheckResult.score !== 'number' || typeof factCheckResult.details !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Invalid fact-check response',
            factCheckResult,
            newsletterResult
          }, { status: 500 })
        }

        console.log('Fact-check score:', factCheckResult.score, 'Details:', factCheckResult.details)

        return NextResponse.json({
          success: true,
          message: 'Article generation test completed successfully',
          post: {
            id: post.id,
            title: post.title.substring(0, 100),
            rating: post.post_ratings?.[0]
          },
          newsletter: {
            headline: newsletterResult.headline,
            content: newsletterResult.content,
            word_count: newsletterResult.word_count
          },
          fact_check: {
            score: factCheckResult.score,
            details: factCheckResult.details,
            accuracy_score: factCheckResult.accuracy_score,
            timeliness_score: factCheckResult.timeliness_score,
            explanation: factCheckResult.explanation
          }
        })

      } catch (error) {
        console.error('Article generation test failed:', error)
        return NextResponse.json({
          error: 'Failed to test article generation',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    }
  },

  // ─── test-checkout ─── (GET)
  'test-checkout': {
    GET: async ({ logger }) => {
      const results: any = {
        timestamp: new Date().toISOString(),
        checks: {}
      }

      // Check 1: Stripe Secret Key
      const stripeKey = process.env.STRIPE_SECRET_KEY
      results.checks.stripe_key = {
        exists: !!stripeKey,
        format: stripeKey ? `${stripeKey.substring(0, 7)}...` : 'NOT SET',
        is_test_key: stripeKey?.startsWith('sk_test_') || false,
        is_live_key: stripeKey?.startsWith('sk_live_') || false
      }

      // Check 2: Database table exists
      try {
        const { data, error } = await supabaseAdmin
          .from('pending_event_submissions')
          .select('id')
          .limit(1)

        results.checks.database_table = {
          exists: !error,
          error: error?.message || null
        }
      } catch (err) {
        results.checks.database_table = {
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      }

      // Check 3: Test Stripe API connection
      if (stripeKey) {
        try {
          const stripeResponse = await fetch('https://api.stripe.com/v1/products?limit=1', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeKey}`,
            }
          })

          results.checks.stripe_api = {
            status: stripeResponse.status,
            ok: stripeResponse.ok,
            error: stripeResponse.ok ? null : await stripeResponse.text()
          }
        } catch (err) {
          results.checks.stripe_api = {
            status: 'error',
            ok: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          }
        }
      } else {
        results.checks.stripe_api = {
          status: 'skipped',
          ok: false,
          error: 'No Stripe key configured'
        }
      }

      // Check 4: Environment variables
      results.checks.environment = {
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || 'NOT SET',
        STRIPE_SECRET_KEY_SET: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET_SET: !!process.env.STRIPE_WEBHOOK_SECRET
      }

      return NextResponse.json(results, { status: 200 })
    }
  },

  // ─── test-csv-parsing ─── (POST)
  'test-csv-parsing': {
    POST: async ({ request, logger }) => {
      try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Read the CSV content
        const csvContent = await file.text()

        // Parse CSV properly handling multi-line entries and quotes
        const parsedCSV = parseCSVContent(csvContent)

        console.log('Raw CSV content length:', csvContent.length)
        console.log('Total parsed rows:', parsedCSV.length)

        // Expected columns mapping
        const columnMapping = {
          'Title': 'title',
          'Main Image URL': 'main_image_url',
          'City': 'city',
          'Bedrooms': 'bedrooms',
          'Bathrooms': 'bathrooms',
          'Sleeps': 'sleeps',
          'Link': 'link',
          'Non-Tracked Link': 'non_tracked_link',
          'Local/Greater': 'listing_type',
          'Adjusted Main Image URL': 'adjusted_image_url'
        }

        if (parsedCSV.length < 2) {
          return NextResponse.json({
            error: 'CSV must have at least a header and one data row',
            parsedRows: parsedCSV.length,
            firstRow: parsedCSV[0] || null
          }, { status: 400 })
        }

        // Parse CSV header
        const headers = parsedCSV[0].map(h => h.trim().replace(/"/g, ''))
        console.log('Headers found:', headers)

        // Find column indices
        const columnIndices: { [key: string]: number } = {}
        for (const [csvHeader, dbField] of Object.entries(columnMapping)) {
          const index = headers.findIndex(h => h === csvHeader)
          if (index !== -1) {
            columnIndices[dbField] = index
          }
        }

        console.log('Column indices:', columnIndices)

        // Validate required columns
        const requiredFields = ['title', 'link', 'listing_type']
        const missingFields = requiredFields.filter(field => !(field in columnIndices))

        if (missingFields.length > 0) {
          return NextResponse.json({
            error: `Missing required columns: ${missingFields.map(f =>
              Object.keys(columnMapping).find(k => columnMapping[k as keyof typeof columnMapping] === f)
            ).join(', ')}`,
            headers,
            columnIndices,
            missingFields
          }, { status: 400 })
        }

        // Analyze each data row without processing
        const rowAnalysis = []
        for (let i = 1; i < parsedCSV.length; i++) {
          const values = parsedCSV[i]
          const rowData: any = {}

          for (const [dbField, index] of Object.entries(columnIndices)) {
            const value = values[index]?.trim().replace(/"/g, '') || null
            rowData[dbField] = value
          }

          rowAnalysis.push({
            rowIndex: i,
            rawValues: values,
            extractedData: rowData,
            hasRequiredFields: rowData.title && rowData.link && rowData.listing_type,
            valuesLength: values.length,
            expectedColumns: Object.keys(columnIndices).length
          })
        }

        return NextResponse.json({
          success: true,
          totalRows: parsedCSV.length,
          headerRow: parsedCSV[0],
          dataRows: parsedCSV.length - 1,
          headers,
          columnIndices,
          rowAnalysis
        })

      } catch (error) {
        console.error('CSV test error:', error)
        return NextResponse.json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-deduper ─── (GET, maxDuration: 600)
  'test-deduper': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      try {
        // Get all rated posts for this issue
        const { data: posts, error } = await supabaseAdmin
          .from('rss_posts')
          .select(`
            id,
            title,
            description,
            content,
            full_article_text,
            post_ratings!inner(total_score)
          `)
          .eq('issue_id', issueId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Query error:', error)
          throw error
        }

        console.log(`Found ${posts?.length || 0} rated posts`)

        if (!posts || posts.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'No rated posts found for this issue'
          })
        }

        // Prepare post summaries for deduper
        const postSummaries = posts.map(post => ({
          title: post.title,
          description: post.description || '',
          full_article_text: post.full_article_text || post.content || ''
        }))

        console.log('=== TESTING TOPIC DEDUPER ===')
        console.log(`Processing ${postSummaries.length} posts`)
        console.log('Post titles:', postSummaries.map(p => p.title))

        // Call the deduper
        const prompt = await AI_PROMPTS.topicDeduper(postSummaries)
        console.log('=== DEDUPER PROMPT ===')
        console.log(prompt.substring(0, 500) + '...')

        const result = await callOpenAI(prompt)

        console.log('=== DEDUPER RESULT ===')
        console.log('Result type:', typeof result)
        console.log('Has groups?', !!result.groups)
        console.log('Groups length:', result.groups?.length || 0)
        console.log('Full result:', JSON.stringify(result, null, 2))

        return NextResponse.json({
          success: true,
          issue_id: issueId,
          total_posts: posts.length,
          post_titles: postSummaries.map((p, i) => ({ index: i, title: p.title })),
          deduper_result: result,
          duplicate_groups_found: result.groups?.length || 0
        })

      } catch (error) {
        console.error('Test deduper error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
    maxDuration: 600
  },

  // ─── test-fallback-search ─── (POST)
  'test-fallback-search': {
    POST: async ({ request, logger }) => {
      try {
        const { imageUrl } = await request.json()

        if (!imageUrl) {
          return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
        }

        console.log('Testing fallback search methods for:', imageUrl)
        const results: SearchResult[] = []

        // Method 1: Extract source from URL patterns
        const urlPatterns = await testUrlPatternMethod(imageUrl)
        results.push(...urlPatterns)

        // Method 2: TinEye API (if configured)
        try {
          const tinEyeResults = await testTinEyeSearch(imageUrl)
          results.push(...tinEyeResults)
        } catch (error) {
          console.log('TinEye not configured:', error)
        }

        // Method 3: SerpAPI (if configured)
        try {
          const serpResults = await testSerpApiSearch(imageUrl)
          results.push(...serpResults)
        } catch (error) {
          console.log('SerpAPI not configured:', error)
        }

        return NextResponse.json({
          success: true,
          imageUrl,
          results,
          totalResults: results.length,
          methods: {
            urlPattern: urlPatterns.length,
            tinEye: results.filter(r => r.method === 'TinEye').length,
            serpApi: results.filter(r => r.method === 'SerpAPI').length
          }
        })

      } catch (error) {
        console.error('Fallback search error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  },

  // ─── test-featured-query ─── (GET)
  'test-featured-query': {
    GET: async ({ logger }) => {
      try {
        // Test the exact query used in event population for Oct 9
        const startDate = '2025-10-09'
        const endDate = '2025-10-09'

        console.log('Testing featured event query for date:', startDate)

        const { data: availableEvents, error: eventsError } = await supabaseAdmin
          .from('events')
          .select('*')
          .gte('start_date', startDate)
          .lte('start_date', endDate + 'T23:59:59')
          .eq('active', true)
          .order('start_date', { ascending: true })

        if (eventsError) {
          return NextResponse.json({
            error: 'Query failed',
            details: eventsError
          }, { status: 500 })
        }

        // Filter for featured events (same logic as line 1287)
        const featuredEvents = availableEvents?.filter(e => e.featured) || []
        const nonFeaturedEvents = availableEvents?.filter(e => !e.featured) || []

        // Get detailed info about submitted events
        const submittedEvents = availableEvents?.filter(e =>
          e.external_id?.startsWith('submitted_')
        ) || []

        return NextResponse.json({
          query: {
            startDate,
            endDate,
            filter: 'active=true'
          },
          results: {
            total: availableEvents?.length || 0,
            featured: featuredEvents.length,
            nonFeatured: nonFeaturedEvents.length,
            submitted: submittedEvents.length
          },
          featuredEventDetails: featuredEvents.map(e => ({
            id: e.id,
            title: e.title,
            featured: e.featured,
            paid_placement: e.paid_placement,
            external_id: e.external_id,
            created_at: e.created_at,
            updated_at: e.updated_at
          })),
          submittedEventDetails: submittedEvents.map(e => ({
            id: e.id,
            title: e.title,
            featured: e.featured,
            paid_placement: e.paid_placement,
            external_id: e.external_id,
            active: e.active,
            created_at: e.created_at,
            updated_at: e.updated_at
          })),
          allEventsBasicInfo: availableEvents?.map(e => ({
            title: e.title,
            featured: e.featured,
            active: e.active,
            external_id: e.external_id?.substring(0, 20)
          }))
        })

      } catch (error) {
        return NextResponse.json({
          error: 'Unexpected error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-fetch ─── (GET)
  'test-fetch': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const imageUrl = searchParams.get('url')

        if (!imageUrl) {
          return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
        }

        console.log('=== FETCH DEBUG TEST ===')
        console.log('Testing URL:', imageUrl)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        try {
          console.log('Attempting fetch with AI-Pro-Daily user agent...')
          const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'AI-Pro-Daily/1.0'
            }
          })

          clearTimeout(timeoutId)

          console.log('Response status:', response.status)
          console.log('Response headers:', Object.fromEntries(response.headers.entries()))

          const contentType = response.headers.get('content-type')

          if (!response.ok) {
            return NextResponse.json({
              debug: 'Fetch Test',
              url: imageUrl,
              success: false,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              error: `HTTP ${response.status} ${response.statusText}`
            })
          }

          // Get content length without downloading full image
          const contentLength = response.headers.get('content-length')

          return NextResponse.json({
            debug: 'Fetch Test',
            url: imageUrl,
            success: true,
            status: response.status,
            statusText: response.statusText,
            contentType,
            contentLength,
            headers: Object.fromEntries(response.headers.entries())
          })

        } catch (fetchError) {
          clearTimeout(timeoutId)

          return NextResponse.json({
            debug: 'Fetch Test',
            url: imageUrl,
            success: false,
            error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
            errorType: fetchError instanceof Error ? fetchError.name : 'UnknownError'
          })
        }

      } catch (error) {
        console.error('Debug endpoint error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: 'Failed to run fetch test'
        }, { status: 500 })
      }
    }
  },

  // ─── test-github-upload ─── (POST)
  'test-github-upload': {
    POST: async ({ logger }) => {
      try {
        console.log('=== TESTING SUPABASE IMAGE UPLOAD ===')

        const testImageUrl = 'https://picsum.photos/800/600'

        const storage = new SupabaseImageStorage()

        console.log('Attempting to upload test image...')
        const result = await storage.uploadImage(testImageUrl, 'Supabase Upload Test')

        return NextResponse.json({
          success: !!result,
          message: result ? 'Image upload test successful!' : 'Upload returned null',
          originalUrl: testImageUrl,
          hostedUrl: result,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Upload test failed:', error)
        return NextResponse.json({
          success: false,
          error: 'Image upload test failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }
  },

  // ─── test-google-credentials ─── (GET)
  'test-google-credentials': {
    GET: async ({ logger }) => {
      try {
        console.log('=== Google Credentials Debug ===')

        // Check environment variables
        const hasCredentialsJson = !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
        const hasProjectId = !!process.env.GOOGLE_CLOUD_PROJECT_ID
        const hasKeyFilename = !!process.env.GOOGLE_APPLICATION_CREDENTIALS

        console.log('Environment check:')
        console.log('- GOOGLE_CLOUD_CREDENTIALS_JSON:', hasCredentialsJson)
        console.log('- GOOGLE_CLOUD_PROJECT_ID:', hasProjectId)
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', hasKeyFilename)

        if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
          const credString = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
          console.log('Credentials string length:', credString.length)
          console.log('First 100 chars:', credString.substring(0, 100))
          console.log('Contains escaped newlines:', credString.includes('\\n'))
          console.log('Contains actual newlines:', credString.includes('\n'))
        }

        // Test parsing strategies
        const visionService = new GoogleVisionService()
        const config = visionService.getConfig()

        console.log('Vision service config:', config)

        return NextResponse.json({
          success: true,
          environment: {
            hasCredentialsJson,
            hasProjectId,
            hasKeyFilename,
            credentialsLength: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON?.length || 0
          },
          visionConfig: config,
          message: 'Check server logs for detailed credential analysis'
        })

      } catch (error) {
        console.error('Google credentials debug error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Check server logs for detailed error analysis'
        })
      }
    }
  },

  // ─── test-google-vision ─── (GET + POST)
  'test-google-vision': {
    GET: async ({ request, logger }) => {
      try {
        const searchParams = request.nextUrl.searchParams
        const imageUrl = searchParams.get('image_url')

        if (!imageUrl) {
          return NextResponse.json(
            { error: 'image_url parameter required' },
            { status: 400 }
          )
        }

        console.log('Testing Google Vision with image:', imageUrl)

        const visionService = new GoogleVisionService()
        const config = visionService.getConfig()

        // Check configuration
        if (!config.isConfigured) {
          return NextResponse.json({
            error: 'Google Cloud Vision not configured',
            config: {
              hasProjectId: !!config.projectId,
              hasCredentials: config.hasCredentials,
              environmentVars: {
                GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
                GOOGLE_CLOUD_CREDENTIALS_JSON: !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
              }
            }
          })
        }

        // Test the Vision API
        const startTime = Date.now()
        const results = await visionService.reverseImageSearch(imageUrl)
        const duration = Date.now() - startTime

        return NextResponse.json({
          success: true,
          config,
          test_image_url: imageUrl,
          duration_ms: duration,
          results_count: results.length,
          results: results.slice(0, 5),
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Google Vision test error:', error)

        return NextResponse.json({
          error: 'Google Vision test failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    },
    POST: async ({ request, logger }) => {
      try {
        const { image_id } = await request.json()

        if (!image_id) {
          return NextResponse.json(
            { error: 'image_id required' },
            { status: 400 }
          )
        }

        // Get image from database
        const { data: image, error: fetchError } = await supabaseAdmin
          .from('images')
          .select('*')
          .eq('id', image_id)
          .single()

        if (fetchError || !image) {
          return NextResponse.json(
            { error: 'Image not found' },
            { status: 404 }
          )
        }

        const imageUrl = image.cdn_url
        if (!imageUrl) {
          return NextResponse.json(
            { error: 'Image URL not available' },
            { status: 400 }
          )
        }

        // Test Vision API with this specific image
        const visionService = new GoogleVisionService()
        const startTime = Date.now()
        const results = await visionService.reverseImageSearch(imageUrl)
        const duration = Date.now() - startTime

        return NextResponse.json({
          success: true,
          image_id,
          image_url: imageUrl,
          duration_ms: duration,
          results_count: results.length,
          results,
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Google Vision image test error:', error)
        return NextResponse.json({
          error: 'Test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-image-analysis ─── (GET + POST)
  'test-image-analysis': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing image analysis database columns...')

        // Test if the new columns exist by trying to select them
        const { data: testQuery, error: testError } = await supabaseAdmin
          .from('images')
          .select('id, age_groups, ocr_text, text_density, ocr_entities, signage_conf')
          .limit(1)

        if (testError) {
          console.error('Database column test failed:', testError)
          return NextResponse.json({
            error: 'Database column test failed',
            details: testError.message,
            suggestion: 'You need to add the missing columns to your Supabase database'
          }, { status: 500 })
        }

        // Test if we can query existing images with the new columns
        const { data: existingImages, error: queryError } = await supabaseAdmin
          .from('images')
          .select('id, age_groups, ocr_text, text_density, ocr_entities, signage_conf')
          .limit(5)

        if (queryError) {
          console.error('Query test failed:', queryError)
          return NextResponse.json({
            error: 'Query test failed - columns may not exist',
            details: queryError.message,
            code: queryError.code
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'All database columns are working correctly',
          test_completed: new Date().toISOString(),
          sample_data: existingImages,
          columns_verified: ['age_groups', 'ocr_text', 'text_density', 'ocr_entities', 'signage_conf']
        })

      } catch (error) {
        console.error('Test endpoint error:', error)
        return NextResponse.json({
          error: 'Test endpoint error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
    POST: async ({ request, logger }) => {
      try {
        const { secret } = await request.json()

        if (secret !== 'test123') {
          return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
        }

        // Show current database schema for images table
        const { data: schemaData, error: schemaError } = await supabaseAdmin
          .rpc('get_table_columns', { table_name: 'images' })

        if (schemaError) {
          console.log('Schema query failed, trying alternative approach...')

          const { data: sampleRow, error: sampleError } = await supabaseAdmin
            .from('images')
            .select('*')
            .limit(1)

          if (sampleError) {
            return NextResponse.json({
              error: 'Cannot analyze database schema',
              details: sampleError.message
            }, { status: 500 })
          }

          const columns = sampleRow && sampleRow.length > 0 ? Object.keys(sampleRow[0]) : []

          return NextResponse.json({
            message: 'Database columns analysis',
            columns_found: columns,
            missing_columns: {
              age_groups: !columns.includes('age_groups'),
              ocr_text: !columns.includes('ocr_text'),
              text_density: !columns.includes('text_density'),
              ocr_entities: !columns.includes('ocr_entities'),
              signage_conf: !columns.includes('signage_conf')
            },
            sql_to_run: `
-- Run this SQL in your Supabase SQL Editor:
ALTER TABLE images
ADD COLUMN IF NOT EXISTS age_groups JSONB,
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS text_density FLOAT,
ADD COLUMN IF NOT EXISTS ocr_entities JSONB,
ADD COLUMN IF NOT EXISTS signage_conf FLOAT;
            `
          })
        }

        return NextResponse.json({
          message: 'Database schema information',
          schema: schemaData
        })

      } catch (error) {
        console.error('POST endpoint error:', error)
        return NextResponse.json({
          error: 'POST endpoint error',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  // ─── test-image-processing ─── (GET)
  'test-image-processing': {
    GET: async ({ logger }) => {
      try {
        console.log('=== TEST IMAGE PROCESSING ===')

        // First, try to create the bucket if it doesn't exist
        const { data: newBucket, error: createError } = await supabaseAdmin.storage
          .createBucket('newsletter-images', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            fileSizeLimit: 5242880 // 5MB
          })

        console.log('Create bucket result:', newBucket, 'Error:', createError)

        // Test downloading and storing a simple image
        const testImageUrl = 'https://via.placeholder.com/300x200.jpg'
        const testFileName = 'test-image.jpg'

        try {
          console.log('Testing image download from:', testImageUrl)

          const response = await fetch(testImageUrl, {
            signal: AbortSignal.timeout(10000)
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const buffer = await response.arrayBuffer()
          console.log('Downloaded image, size:', buffer.byteLength)

          // Upload to Supabase Storage
          const { data, error } = await supabaseAdmin.storage
            .from('newsletter-images')
            .upload(`articles/${testFileName}`, buffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            })

          console.log('Upload result:', data, 'Error:', error)

          if (data) {
            // Get public URL
            const { data: urlData } = supabaseAdmin.storage
              .from('newsletter-images')
              .getPublicUrl(`articles/${testFileName}`)

            console.log('Public URL:', urlData.publicUrl)

            return NextResponse.json({
              success: true,
              bucketCreated: !createError,
              uploadSuccessful: !error,
              testImageUrl: urlData.publicUrl,
              uploadData: data,
              error: error
            })
          } else {
            return NextResponse.json({
              success: false,
              error: error,
              message: 'Failed to upload test image'
            })
          }

        } catch (downloadError) {
          console.error('Image download/upload error:', downloadError)
          return NextResponse.json({
            success: false,
            error: downloadError instanceof Error ? downloadError.message : 'Unknown download error'
          })
        }

      } catch (error) {
        console.error('Test image processing error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: 'Failed to test image processing'
        }, { status: 500 })
      }
    }
  },

  // ─── test-image-storage ─── (GET)
  'test-image-storage': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing image storage setup...')

        // Check if images bucket exists
        const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets()

        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError)
          return NextResponse.json({
            error: 'Failed to list storage buckets',
            details: bucketsError
          }, { status: 500 })
        }

        const imagesBucket = buckets?.find(bucket => bucket.name === 'images')

        if (!imagesBucket) {
          console.log('Images bucket does not exist, attempting to create...')

          const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket('images', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            fileSizeLimit: 10485760 // 10MB
          })

          if (createError) {
            console.error('Error creating bucket:', createError)
            return NextResponse.json({
              error: 'Failed to create images bucket',
              details: createError,
              availableBuckets: buckets?.map(b => b.name) || []
            }, { status: 500 })
          }

          console.log('Images bucket created successfully:', newBucket)
        }

        // Test creating a signed upload URL
        try {
          const testObjectKey = `images/original/test-${Date.now()}.jpg`
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('images')
            .createSignedUploadUrl(testObjectKey, {
              upsert: true
            })

          if (uploadError) {
            console.error('Error creating signed upload URL:', uploadError)
            return NextResponse.json({
              error: 'Failed to create signed upload URL',
              details: uploadError,
              bucketExists: !!imagesBucket,
              bucketInfo: imagesBucket
            }, { status: 500 })
          }

          // Test images table exists
          const { data: testQuery, error: tableError } = await supabaseAdmin
            .from('images')
            .select('id')
            .limit(1)

          if (tableError) {
            console.error('Error querying images table:', tableError)
            return NextResponse.json({
              error: 'Images table not found or not accessible',
              details: tableError,
              bucketExists: !!imagesBucket,
              signedUrlWorks: !!uploadData
            }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            bucketExists: !!imagesBucket,
            bucketInfo: imagesBucket,
            signedUrlWorks: !!uploadData,
            testUploadUrl: uploadData?.signedUrl,
            imagesTableExists: true,
            availableBuckets: buckets?.map(b => ({ name: b.name, public: b.public })) || []
          })

        } catch (testError) {
          console.error('Error during storage test:', testError)
          return NextResponse.json({
            error: 'Storage test failed',
            details: testError instanceof Error ? testError.message : testError,
            bucketExists: !!imagesBucket
          }, { status: 500 })
        }

      } catch (error) {
        console.error('Debug storage test error:', error)
        return NextResponse.json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : error
        }, { status: 500 })
      }
    }
  },

  // ─── test-mailerlite ─── (GET)
  'test-mailerlite': {
    GET: async ({ logger }) => {
      try {
        console.log('Testing MailerLite integration...')

        // Get the latest issue that's in draft status
        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles(
              *,
              rss_post:rss_posts(
                *,
                rss_feed:rss_feeds(*)
              )
            ),
            manual_articles:manual_articles(*)
          `)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (issueError || !issue) {
          // Try to get the latest in_review issue instead
          const { data: reviewissue, error: reviewError } = await supabaseAdmin
            .from('publication_issues')
            .select(`
              *,
              articles:articles(
                *,
                rss_post:rss_posts(
                  *,
                  rss_feed:rss_feeds(*)
                )
              ),
              manual_articles:manual_articles(*)
            `)
            .eq('status', 'in_review')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (reviewError || !reviewissue) {
            return NextResponse.json({
              success: false,
              error: 'No draft or in_review issues found for testing',
              drafttError: issueError?.message,
              reviewError: reviewError?.message
            }, { status: 404 })
          }

          return NextResponse.json({
            success: true,
            message: 'Found in_review issue (already processed)',
            issue: {
              id: reviewissue.id,
              date: reviewissue.date,
              status: reviewissue.status,
              subject_line: reviewissue.subject_line,
              review_sent_at: reviewissue.review_sent_at,
              active_articles: reviewissue.articles.filter((a: any) => a.is_active).length
            },
            note: 'This issue was already sent to MailerLite (status is in_review)'
          })
        }

        // Check if issue has required data
        const activeArticles = issue.articles.filter((article: any) => article.is_active)
        if (activeArticles.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No active articles found in issue',
            issueId: issue.id
          }, { status: 400 })
        }

        if (!issue.subject_line || issue.subject_line.trim() === '') {
          return NextResponse.json({
            success: false,
            error: 'No subject line found in issue',
            issueId: issue.id
          }, { status: 400 })
        }

        console.log(`Testing with issue ${issue.id} (${issue.date})`)
        console.log(`Active articles: ${activeArticles.length}`)
        console.log(`Subject line: ${issue.subject_line}`)

        // Test MailerLite service
        const mailerLiteService = new MailerLiteService()
        const result = await mailerLiteService.createReviewissue(issue)

        return NextResponse.json({
          success: true,
          message: 'MailerLite issue created successfully',
          result,
          issue: {
            id: issue.id,
            date: issue.date,
            subject_line: issue.subject_line,
            active_articles: activeArticles.length
          }
        })

      } catch (error) {
        console.error('MailerLite test failed:', error)
        return NextResponse.json({
          success: false,
          error: 'MailerLite test failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },
}
