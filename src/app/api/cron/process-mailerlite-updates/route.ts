import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BATCH_SIZE = 100 // Process up to 100 updates per run
const MAX_RETRIES = 3 // Max retry attempts before marking as failed

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

  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processMailerLiteUpdates()
    return NextResponse.json(result)
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
