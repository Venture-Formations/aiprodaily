import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'

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
 * Main processing function for SendGrid field updates
 */
async function processSendGridUpdates() {
  const startTime = Date.now()
  const sendgrid = new SendGridService()

  // Fetch pending updates
  const { data: pendingUpdates, error: fetchError } = await supabaseAdmin
    .from('sendgrid_field_updates')
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

  console.log(`[SendGrid Updates] Processing ${pendingUpdates.length} pending updates`)

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
    // Combine all field updates for this subscriber into a single update
    const fields: Record<string, any> = {}
    for (const update of updates) {
      fields[update.field_name] = update.field_value
    }

    // Mark all as processing
    const updateIds = updates.map((u: FieldUpdate) => u.id)
    await supabaseAdmin
      .from('sendgrid_field_updates')
      .update({ status: 'processing' })
      .in('id', updateIds)

    // Update all fields at once for this subscriber
    const result = await sendgrid.updateContactFields(email, fields)

    if (result.success) {
      // Mark all as completed
      await supabaseAdmin
        .from('sendgrid_field_updates')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .in('id', updateIds)

      successCount += updates.length
      console.log(`[SendGrid Updates] Updated ${email}: ${Object.keys(fields).join(', ')}`)
    } else {
      // Handle failure for each update
      for (const update of updates) {
        const newRetryCount = update.retry_count + 1
        const shouldRetry = newRetryCount < MAX_RETRIES

        await supabaseAdmin
          .from('sendgrid_field_updates')
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
      }

      console.error(`[SendGrid Updates] Failed ${email}: ${result.error}`)
    }
  }

  const duration = Date.now() - startTime

  return {
    success: true,
    message: 'SendGrid updates processed',
    processed: pendingUpdates.length,
    successful: successCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
    duration_ms: duration,
    timestamp: new Date().toISOString()
  }
}

const handler = withApiHandler(
  { authTier: 'system', logContext: 'process-sendgrid-updates' },
  async () => {
    const result = await processSendGridUpdates()
    return NextResponse.json(result)
  }
)

export const GET = handler
export const POST = handler
