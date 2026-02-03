import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'

const BATCH_SIZE = 100 // Process up to 100 updates per run
const MAX_RETRIES = 3 // Max retry attempts before marking as failed
const REAL_CLICK_FIELD = 'real_click' // MailerLite custom field key (lowercase)

interface FieldUpdate {
  id: string
  subscriber_email: string
  field_name: string
  field_value: boolean
  retry_count: number
  publication_id: string
}

/**
 * Updates a subscriber's custom field in MailerLite
 */
async function updateMailerLiteField(
  email: string,
  fieldName: string,
  fieldValue: boolean
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) {
    return { success: false, error: 'MAILERLITE_API_KEY not configured' }
  }

  try {
    // Use the MailerLite API to update subscriber field
    const response = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          fields: {
            [fieldName]: fieldValue ? 'true' : 'false'
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || `HTTP ${response.status}`

      // 404 means subscriber not found - treat as permanent failure
      if (response.status === 404) {
        return { success: false, error: `Subscriber not found: ${email}` }
      }

      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sync Real_Click field status for all subscribers
 * Only queues updates when state actually changes (new clickers or removed clickers)
 */
async function syncRealClickStatus(): Promise<{
  checked: number
  newClickers: number
  removedClickers: number
  errors: string[]
}> {
  const errors: string[] = []
  let newClickers = 0
  let removedClickers = 0

  // Get all publications
  const { data: publications, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, slug')

  if (pubError || !publications) {
    errors.push(`Failed to fetch publications: ${pubError?.message}`)
    return { checked: 0, newClickers: 0, removedClickers: 0, errors }
  }

  for (const publication of publications) {
    try {
      // Get excluded IPs for this publication
      const { data: excludedIpsData } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publication.id)

      const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))

      // Get ALL link clicks for this publication (paginated)
      const FETCH_BATCH = 1000
      let allClicks: { subscriber_email: string; ip_address: string }[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: clicks, error: clickError } = await supabaseAdmin
          .from('link_clicks')
          .select('subscriber_email, ip_address')
          .eq('publication_id', publication.id)
          .range(offset, offset + FETCH_BATCH - 1)

        if (clickError) {
          errors.push(`[${publication.slug}] Failed to fetch clicks: ${clickError.message}`)
          break
        }

        if (clicks && clicks.length > 0) {
          allClicks = allClicks.concat(clicks)
          offset += FETCH_BATCH
          hasMore = clicks.length === FETCH_BATCH
        } else {
          hasMore = false
        }
      }

      // Filter to valid (non-excluded IP) clicks and get unique emails
      const validClicks = allClicks.filter(c => !isIPExcluded(c.ip_address, exclusions))
      const emailsWithValidClicks = new Set(validClicks.map(c => c.subscriber_email.toLowerCase()))

      // Get current stored state
      const { data: currentStatus } = await supabaseAdmin
        .from('subscriber_real_click_status')
        .select('subscriber_email, has_real_click')
        .eq('publication_id', publication.id)

      const currentStatusMap = new Map<string, boolean>()
      for (const status of currentStatus || []) {
        currentStatusMap.set(status.subscriber_email.toLowerCase(), status.has_real_click)
      }

      // Find changes
      const toSetTrue: string[] = []
      const toSetFalse: string[] = []

      // Check for new clickers (have valid clicks but state is FALSE or missing)
      for (const email of Array.from(emailsWithValidClicks)) {
        const currentState = currentStatusMap.get(email)
        if (currentState !== true) {
          toSetTrue.push(email)
        }
      }

      // Check for removed clickers (state is TRUE but no valid clicks)
      for (const [email, hasClick] of Array.from(currentStatusMap.entries())) {
        if (hasClick && !emailsWithValidClicks.has(email)) {
          toSetFalse.push(email)
        }
      }

      // Queue updates for new clickers
      for (const email of toSetTrue) {
        // Check if already queued
        const { data: existing } = await supabaseAdmin
          .from('mailerlite_field_updates')
          .select('id')
          .eq('subscriber_email', email)
          .eq('field_name', REAL_CLICK_FIELD)
          .eq('field_value', true)
          .in('status', ['pending', 'processing'])
          .limit(1)
          .maybeSingle()

        if (!existing) {
          await supabaseAdmin
            .from('mailerlite_field_updates')
            .insert({
              subscriber_email: email,
              field_name: REAL_CLICK_FIELD,
              field_value: true,
              status: 'pending',
              publication_id: publication.id
            })
          newClickers++
        }

        // Upsert local state
        await supabaseAdmin
          .from('subscriber_real_click_status')
          .upsert({
            publication_id: publication.id,
            subscriber_email: email,
            has_real_click: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'publication_id,subscriber_email' })
      }

      // Queue updates for removed clickers
      for (const email of toSetFalse) {
        // Check if already queued
        const { data: existing } = await supabaseAdmin
          .from('mailerlite_field_updates')
          .select('id')
          .eq('subscriber_email', email)
          .eq('field_name', REAL_CLICK_FIELD)
          .eq('field_value', false)
          .in('status', ['pending', 'processing'])
          .limit(1)
          .maybeSingle()

        if (!existing) {
          await supabaseAdmin
            .from('mailerlite_field_updates')
            .insert({
              subscriber_email: email,
              field_name: REAL_CLICK_FIELD,
              field_value: false,
              status: 'pending',
              publication_id: publication.id
            })
          removedClickers++
        }

        // Update local state
        await supabaseAdmin
          .from('subscriber_real_click_status')
          .update({
            has_real_click: false,
            updated_at: new Date().toISOString()
          })
          .eq('publication_id', publication.id)
          .eq('subscriber_email', email)
      }

      console.log(`[Real_Click Sync] ${publication.slug}: ${emailsWithValidClicks.size} valid clickers, ${toSetTrue.length} new, ${toSetFalse.length} removed`)

    } catch (error) {
      errors.push(`[${publication.slug}] Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  return {
    checked: publications.length,
    newClickers,
    removedClickers,
    errors
  }
}

/**
 * Main processing function
 */
async function processMailerLiteUpdates() {
  const startTime = Date.now()

  // Fetch pending updates
  const { data: pendingUpdates, error: fetchError } = await supabaseAdmin
    .from('mailerlite_field_updates')
    .select('id, subscriber_email, field_name, field_value, retry_count, publication_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchError) {
    throw new Error(`Failed to fetch pending updates: ${fetchError.message}`)
  }

  if (!pendingUpdates || pendingUpdates.length === 0) {
    return {
      success: true,
      message: 'No pending updates to process',
      processed: 0,
      successful: 0,
      failed: 0,
      timestamp: new Date().toISOString()
    }
  }

  console.log(`[MailerLite Updates] Processing ${pendingUpdates.length} pending updates`)

  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  // Group updates by subscriber to batch updates for same subscriber
  const updatesBySubscriber = new Map<string, FieldUpdate[]>()
  for (const update of pendingUpdates as FieldUpdate[]) {
    const existing = updatesBySubscriber.get(update.subscriber_email) || []
    existing.push(update)
    updatesBySubscriber.set(update.subscriber_email, existing)
  }

  // Process each subscriber's updates
  for (const [email, updates] of Array.from(updatesBySubscriber.entries())) {
    // Combine all field updates for this subscriber
    const fields: Record<string, boolean> = {}
    for (const update of updates) {
      fields[update.field_name] = update.field_value
    }

    // Mark all as processing
    const updateIds = updates.map((u: FieldUpdate) => u.id)
    await supabaseAdmin
      .from('mailerlite_field_updates')
      .update({ status: 'processing' })
      .in('id', updateIds)

    // Process each field update (could batch but keeping simple for now)
    for (const update of updates) {
      const result = await updateMailerLiteField(
        email,
        update.field_name,
        update.field_value
      )

      if (result.success) {
        // Mark as completed
        await supabaseAdmin
          .from('mailerlite_field_updates')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', update.id)

        successCount++
        console.log(`[MailerLite Updates] Updated ${email}: ${update.field_name}=true`)
      } else {
        const newRetryCount = update.retry_count + 1
        const shouldRetry = newRetryCount < MAX_RETRIES

        await supabaseAdmin
          .from('mailerlite_field_updates')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            retry_count: newRetryCount,
            error_message: result.error,
            processed_at: shouldRetry ? null : new Date().toISOString()
          })
          .eq('id', update.id)

        if (!shouldRetry) {
          failedCount++
          errors.push(`${email}/${update.field_name}: ${result.error}`)
        }

        console.error(`[MailerLite Updates] Failed ${email}: ${result.error} (retry ${newRetryCount}/${MAX_RETRIES})`)
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    success: true,
    message: 'MailerLite updates processed',
    processed: pendingUpdates.length,
    successful: successCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
    duration_ms: duration,
    timestamp: new Date().toISOString()
  }
}

// Handle GET requests from Vercel cron
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')
  const forceSync = searchParams.get('sync_real_click') === 'true'

  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let realClickSyncResult = null

    // Run Real_Click sync once daily (at 6 AM hour) or when forced
    const currentHour = new Date().getHours()
    const currentMinute = new Date().getMinutes()
    // Run during the 6:00-6:05 window (cron runs every 5 mins)
    const isDailySyncTime = currentHour === 6 && currentMinute < 5

    if (forceSync || isDailySyncTime) {
      console.log('[MailerLite Updates] Running Real_Click sync...')
      realClickSyncResult = await syncRealClickStatus()
      console.log(`[MailerLite Updates] Real_Click sync complete: ${realClickSyncResult.newClickers} new, ${realClickSyncResult.removedClickers} removed`)
    }

    // Always process the queue
    const result = await processMailerLiteUpdates()

    return NextResponse.json({
      ...result,
      realClickSync: realClickSyncResult
    })
  } catch (error) {
    console.error('[MailerLite Updates] Cron error:', error)
    return NextResponse.json({
      error: 'MailerLite updates processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle POST requests for manual triggers with auth header
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processMailerLiteUpdates()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[MailerLite Updates] Manual trigger error:', error)
    return NextResponse.json({
      error: 'MailerLite updates processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
