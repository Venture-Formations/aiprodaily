import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const AD_COLUMNS = `
  id, publication_id, title, body, word_count, button_text, button_url,
  frequency, times_paid, times_used, status, display_order, payment_status,
  paid, image_url, image_alt, submission_date, ad_module_id, advertiser_id,
  priority, ad_type, company_name, cta_text, last_used_date, created_at, updated_at
`

// GET all ads with optional status and ad_module_id filters
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'ads', requirePublicationId: true },
  async ({ request, publicationId }) => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const adModuleId = searchParams.get('ad_module_id')

    let query = supabaseAdmin
      .from('advertisements')
      .select(`
        ${AD_COLUMNS},
        ad_module:ad_modules(id, name),
        advertiser:advertisers(id, company_name, logo_url)
      `)
      .eq('publication_id', publicationId!)
      .order('created_at', { ascending: false })

    // Filter by ad_module_id
    if (adModuleId === 'null' || adModuleId === 'legacy') {
      // Legacy advertorial ads (no ad_module_id)
      query = query.is('ad_module_id', null)
    } else if (adModuleId) {
      query = query.eq('ad_module_id', adModuleId)
    }

    if (status) {
      // Handle comma-separated status values
      const statuses = status.split(',').map(s => s.trim())
      if (statuses.length > 1) {
        query = query.in('status', statuses)
      } else {
        query = query.eq('status', status)
      }
    }

    const { data: ads, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ads })
  }
)

const createAdSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  word_count: z.number().int().optional(),
  button_text: z.string().optional().default(''),
  button_url: z.string().min(1, 'Button URL is required'),
  frequency: z.enum(['single', 'weekly', 'monthly']).optional().default('single'),
  times_paid: z.number().int().optional().default(1),
  status: z.enum(['pending', 'approved', 'active', 'paused', 'completed', 'rejected']).optional().default('approved'),
  useInNextNewsletter: z.boolean().optional().default(false),
  payment_status: z.enum(['paid', 'pending', 'free']).optional().default('paid'),
  paid: z.boolean().optional().default(true),
  image_url: z.string().url().nullable().optional(),
  image_alt: z.string().nullable().optional(),
  ad_module_id: z.string().uuid().nullable().optional(),
  advertiser_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().optional().default(0),
  ad_type: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  cta_text: z.string().nullable().optional(),
})

// POST - Create new ad (admin only)
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'ads', requirePublicationId: true, inputSchema: createAdSchema },
  async ({ input, publicationId, logger }) => {
    const {
      title,
      body: adBody,
      word_count,
      button_text,
      button_url,
      frequency,
      times_paid
    } = input

    // Normalize URL: ensure https:// prefix
    let normalizedUrl = button_url.trim()
    if (normalizedUrl && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    // Determine display_order if status is active
    let display_order = null
    const requestedStatus = input.status || 'approved'
    const useInNextNewsletter = input.useInNextNewsletter || false

    if (requestedStatus === 'active') {
      if (useInNextNewsletter) {
        // Get the current next_ad_position from publication_settings (for this newsletter)
        const { data: settingsData, error: settingsError } = await supabaseAdmin
          .from('publication_settings')
          .select('value')
          .eq('publication_id', publicationId)
          .eq('key', 'next_ad_position')
          .maybeSingle()

        if (settingsError) {
          logger.error({ err: settingsError }, 'Error fetching next_ad_position')
        }

        const nextAdPosition = settingsData ? parseInt(settingsData.value) : 1
        display_order = nextAdPosition

        // Shift all ads with display_order >= nextAdPosition by +1
        const { data: adsToShift, error: fetchAdsError } = await supabaseAdmin
          .from('advertisements')
          .select('id, display_order')
          .eq('publication_id', publicationId)
          .eq('status', 'active')
          .gte('display_order', nextAdPosition)
          .not('display_order', 'is', null)

        if (fetchAdsError) {
          logger.error({ err: fetchAdsError }, 'Error fetching ads to shift')
        }

        // Increment display_order for each ad that needs to shift
        if (adsToShift && adsToShift.length > 0) {
          for (const ad of adsToShift) {
            await supabaseAdmin
              .from('advertisements')
              .update({ display_order: (ad.display_order || 0) + 1 })
              .eq('id', ad.id)
          }
        }
      } else {
        // Normal behavior: add to end of queue
        // Get the highest display_order for active ads (for this newsletter)
        const { data: activeAds, error: fetchError } = await supabaseAdmin
          .from('advertisements')
          .select('display_order')
          .eq('publication_id', publicationId)
          .eq('status', 'active')
          .not('display_order', 'is', null)
          .order('display_order', { ascending: false })
          .limit(1)

        if (fetchError) {
          logger.error({ err: fetchError }, 'Error fetching active ads')
        }

        // Set display_order to next available position
        display_order = activeAds && activeAds.length > 0
          ? (activeAds[0].display_order || 0) + 1
          : 1
      }
    }

    const { data: ad, error } = await supabaseAdmin
      .from('advertisements')
      .insert({
        title,
        body: adBody,
        word_count,
        button_text: button_text || '',
        button_url: normalizedUrl,
        frequency: frequency || 'single', // Default to 'single' if not provided
        times_paid: times_paid || 1, // Default to 1 if not provided
        times_used: 0,
        status: requestedStatus,
        display_order: display_order,
        payment_status: input.payment_status || 'paid',
        paid: input.paid !== undefined ? input.paid : true,
        image_url: input.image_url || null,
        image_alt: input.image_alt || null,
        submission_date: new Date().toISOString(),
        publication_id: publicationId,
        ad_module_id: input.ad_module_id || null,
        advertiser_id: input.advertiser_id || null,
        priority: input.priority || 0,
        ad_type: input.ad_type || null,
        company_name: input.company_name || null,
        cta_text: input.cta_text || null
      })
      .select(AD_COLUMNS)
      .single()

    if (error) {
      logger.error({ err: error }, 'Insert error')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!ad) {
      logger.error('Insert returned no data')
      return NextResponse.json({ error: 'Failed to create ad - no data returned' }, { status: 500 })
    }

    // Auto-upsert ad_module_advertisers junction entry for company-based rotation
    if (ad.ad_module_id && ad.advertiser_id) {
      // Get current max display_order for this module
      const { data: maxOrderResult } = await supabaseAdmin
        .from('ad_module_advertisers')
        .select('display_order')
        .eq('ad_module_id', ad.ad_module_id)
        .order('display_order', { ascending: false })
        .limit(1)

      const nextOrder = (maxOrderResult?.[0]?.display_order || 0) + 1

      // Check if junction already exists
      const { data: existingJunction } = await supabaseAdmin
        .from('ad_module_advertisers')
        .select('id')
        .eq('ad_module_id', ad.ad_module_id)
        .eq('advertiser_id', ad.advertiser_id)
        .maybeSingle()

      let junctionError: { message: string } | null = null

      if (existingJunction) {
        // Junction exists — update frequency/paid fields
        const junctionUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString()
        }
        if (frequency) junctionUpdate.frequency = frequency
        if (times_paid !== undefined) junctionUpdate.times_paid = times_paid
        if (input.paid !== undefined) junctionUpdate.paid = input.paid

        if (Object.keys(junctionUpdate).length > 1) {
          const { error } = await supabaseAdmin
            .from('ad_module_advertisers')
            .update(junctionUpdate)
            .eq('id', existingJunction.id)
          junctionError = error
        }
      } else {
        // Create new junction entry with all fields
        const junctionData: Record<string, unknown> = {
          ad_module_id: ad.ad_module_id,
          advertiser_id: ad.advertiser_id,
          display_order: nextOrder,
          next_ad_position: 1,
          times_used: 0,
          priority: 0,
          frequency: frequency || 'single',
          times_paid: times_paid || 0,
          paid: input.paid !== undefined ? input.paid : true
        }

        const { error } = await supabaseAdmin
          .from('ad_module_advertisers')
          .insert(junctionData)
        junctionError = error
      }

      if (junctionError) {
        logger.error({ err: junctionError }, 'Failed to upsert junction entry')
      } else {
        logger.info({ moduleId: ad.ad_module_id, advertiserId: ad.advertiser_id }, 'Ensured junction entry')
      }
    }

    logger.info({ adId: ad.id }, 'Successfully created ad')
    return NextResponse.json({ ad })
  }
)
