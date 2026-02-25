import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { FacebookService } from '@/lib/facebook'

/**
 * GET /api/settings/facebook
 * Returns current Facebook posting settings for the active publication
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/facebook' },
  async () => {
    // Get user's publication_id (use first active newsletter)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const publicationId = newsletter.id

    // Get current Facebook settings from database
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId)
      .like('key', 'facebook_%')

    // Build settings object with defaults
    const facebookSettings: Record<string, string | boolean | null> = {
      enabled: false,
      pageId: '',
      hasAccessToken: false,
      postTime: '10:00',
      adModuleId: '',
      lastPostDate: '',
      lastPostId: '',
    }

    // Map database keys to response keys
    const keyMap: Record<string, string> = {
      facebook_enabled: 'enabled',
      facebook_page_id: 'pageId',
      facebook_page_access_token: 'accessToken',
      facebook_post_time: 'postTime',
      facebook_ad_module_id: 'adModuleId',
      facebook_last_post_date: 'lastPostDate',
      facebook_last_post_id: 'lastPostId',
    }

    settings?.forEach((setting) => {
      // Strip extra quotes if value was JSON stringified
      let cleanValue = setting.value
      if (cleanValue && cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
        cleanValue = cleanValue.slice(1, -1)
      }

      const responseKey = keyMap[setting.key]
      if (responseKey) {
        if (setting.key === 'facebook_enabled') {
          facebookSettings[responseKey] = cleanValue === 'true'
        } else if (setting.key === 'facebook_page_access_token') {
          // Don't expose the actual token, just indicate if one exists
          facebookSettings.hasAccessToken = !!cleanValue && cleanValue.length > 0
        } else {
          facebookSettings[responseKey] = cleanValue || ''
        }
      }
    })

    // Get ad modules for dropdown
    const { data: adModules } = await supabaseAdmin
      .from('ad_modules')
      .select('id, name')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order')

    // If an ad module is selected, get its name
    let adModuleName = ''
    if (facebookSettings.adModuleId && adModules) {
      const selectedModule = adModules.find((m) => m.id === facebookSettings.adModuleId)
      adModuleName = selectedModule?.name || ''
    }

    return NextResponse.json({
      ...facebookSettings,
      adModuleName,
      adModules: adModules || [],
    })
  }
)

/**
 * POST /api/settings/facebook
 * Save Facebook posting settings
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/facebook' },
  async ({ request }) => {
    // Get user's publication_id
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const publicationId = newsletter.id
    const body = await request.json()

    console.log('[Facebook Settings] Saving settings for publication:', publicationId)

    // Build settings to save
    const settingsToSave: Array<{ key: string; value: string }> = [
      { key: 'facebook_enabled', value: body.enabled ? 'true' : 'false' },
      { key: 'facebook_page_id', value: body.pageId || '' },
      { key: 'facebook_post_time', value: body.postTime || '10:00' },
      { key: 'facebook_ad_module_id', value: body.adModuleId || '' },
    ]

    // Only update access token if provided (not empty)
    if (body.accessToken && body.accessToken.trim() !== '') {
      settingsToSave.push({ key: 'facebook_page_access_token', value: body.accessToken })
    }

    // Save each setting
    for (const setting of settingsToSave) {
      const { error } = await supabaseAdmin.from('publication_settings').upsert(
        {
          publication_id: publicationId,
          key: setting.key,
          value: setting.value,
          description: `Facebook posting setting: ${setting.key}`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'publication_id,key',
        }
      )

      if (error) {
        console.error('[Facebook Settings] Error saving', setting.key, ':', error)
        throw error
      }
    }

    console.log('[Facebook Settings] Settings saved successfully')
    return NextResponse.json({ success: true })
  }
)

/**
 * PATCH /api/settings/facebook
 * Verify Facebook token or send test post
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'settings/facebook' },
  async ({ request }) => {
    const body = await request.json()
    const action = body.action

    // Get user's publication_id
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const publicationId = newsletter.id

    // Get current Facebook settings
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publicationId)
      .in('key', ['facebook_page_id', 'facebook_page_access_token', 'facebook_ad_module_id'])

    const settingsMap: Record<string, string> = {}
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value || ''
    })

    const pageId = settingsMap.facebook_page_id
    const accessToken = settingsMap.facebook_page_access_token

    if (!pageId || !accessToken) {
      return NextResponse.json({ error: 'Page ID and Access Token are required' }, { status: 400 })
    }

    const fb = new FacebookService(pageId, accessToken)

    if (action === 'verify') {
      // Verify token
      const tokenResult = await fb.verifyToken()
      const pageResult = await fb.getPageInfo()

      return NextResponse.json({
        valid: tokenResult.valid,
        expiresAt: tokenResult.expiresAt?.toISOString(),
        pageName: pageResult.name,
        error: tokenResult.error || pageResult.error,
      })
    }

    if (action === 'test') {
      // Send test post
      const result = await fb.createPagePost({
        message: 'This is a test post from AIProDaily. If you see this, Facebook posting is configured correctly!',
      })

      if (result.success) {
        return NextResponse.json({
          success: true,
          postId: result.postId,
          message: 'Test post created successfully',
        })
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
    }

    if (action === 'test-ad') {
      // Send test post with actual ad content from the most recently sent issue
      const adModuleId = settingsMap.facebook_ad_module_id

      if (!adModuleId) {
        return NextResponse.json({ error: 'No ad module selected' }, { status: 400 })
      }

      let adContent: {
        title: string
        body: string
        imageUrl: string | null
        buttonUrl: string | null
        source: string
      } | null = null

      // Try to get the ad from the most recently sent issue
      const { data: recentIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date')
        .eq('publication_id', publicationId)
        .eq('status', 'sent')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (recentIssue) {
        const { data: issueAd } = await supabaseAdmin
          .from('issue_module_ads')
          .select(`
            advertisement:advertisements(
              id, title, body, image_url, button_url
            )
          `)
          .eq('issue_id', recentIssue.id)
          .eq('ad_module_id', adModuleId)
          .limit(1)
          .single()

        if (issueAd?.advertisement) {
          const ad = issueAd.advertisement as unknown as { id: string; title: string; body: string; image_url: string | null; button_url: string | null }
          adContent = {
            title: ad.title,
            body: ad.body,
            imageUrl: ad.image_url,
            buttonUrl: ad.button_url,
            source: `Issue ${recentIssue.date}`,
          }
        }
      }

      // Fallback to latest active ad if no issue ad found
      if (!adContent) {
        const { data: latestAd } = await supabaseAdmin
          .from('advertisements')
          .select('id, title, body, image_url, button_url')
          .eq('ad_module_id', adModuleId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestAd) {
          adContent = {
            title: latestAd.title,
            body: latestAd.body,
            imageUrl: latestAd.image_url,
            buttonUrl: latestAd.button_url,
            source: 'Latest active ad (no recent issue found)',
          }
        }
      }

      if (!adContent) {
        return NextResponse.json({ error: 'No ads found in the selected module' }, { status: 400 })
      }

      const message = FacebookService.formatMessage(adContent.body, adContent.buttonUrl || undefined, adContent.title)

      const result = await fb.createPagePost({
        message,
        imageUrl: adContent.imageUrl || undefined,
        linkUrl: adContent.buttonUrl || undefined,
      })

      if (result.success) {
        return NextResponse.json({
          success: true,
          postId: result.postId,
          adTitle: adContent.title,
          adSource: adContent.source,
          message: 'Test ad post created successfully',
        })
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
)
