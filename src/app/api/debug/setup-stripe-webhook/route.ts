import { NextRequest, NextResponse } from 'next/server'

/**
 * One-time setup endpoint to create Stripe webhook
 * This should only be run once to set up the webhook endpoint in Stripe
 */
export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    return NextResponse.json({
      error: 'STRIPE_SECRET_KEY not configured'
    }, { status: 500 })
  }

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/api/webhooks/stripe`

    console.log('[Webhook Setup] Creating webhook endpoint...')
    console.log('[Webhook Setup] URL:', webhookUrl)

    // Create webhook endpoint in Stripe
    const response = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'url': webhookUrl,
        'enabled_events[]': 'checkout.session.completed',
        'description': 'St. Cloud Scoop - Event Checkout Webhook (Test Mode)',
        'api_version': '2023-10-16'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Webhook Setup] Stripe API error:', errorText)

      // Parse error for better display
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
      } catch {
        errorDetails = errorText
      }

      return NextResponse.json({
        error: 'Failed to create webhook',
        details: errorDetails,
        status: response.status
      }, { status: response.status })
    }

    const webhook = await response.json()

    console.log('[Webhook Setup] Webhook created successfully!')
    console.log('[Webhook Setup] Webhook ID:', webhook.id)
    console.log('[Webhook Setup] Secret:', webhook.secret)

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint created successfully!',
      webhook: {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        status: webhook.status,
        enabled_events: webhook.enabled_events
      },
      next_steps: [
        '1. Copy the signing secret above',
        '2. Run: vercel env add STRIPE_WEBHOOK_SECRET production',
        '3. Paste the secret when prompted',
        '4. Test a payment to verify it works'
      ]
    })

  } catch (error) {
    console.error('[Webhook Setup] Error:', error)
    return NextResponse.json({
      error: 'Webhook setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method to check if webhook already exists
export async function GET(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    return NextResponse.json({
      error: 'STRIPE_SECRET_KEY not configured'
    }, { status: 500 })
  }

  try {
    // List existing webhooks
    const response = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        error: 'Failed to list webhooks',
        details: errorText
      }, { status: response.status })
    }

    const data = await response.json()
    const ourWebhookUrl = `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/api/webhooks/stripe`

    const existingWebhook = data.data.find((wh: any) => wh.url === ourWebhookUrl)

    return NextResponse.json({
      webhook_exists: !!existingWebhook,
      webhook: existingWebhook || null,
      all_webhooks: data.data.map((wh: any) => ({
        id: wh.id,
        url: wh.url,
        status: wh.status,
        enabled_events: wh.enabled_events
      })),
      message: existingWebhook
        ? 'Webhook already exists! Use the secret from Stripe Dashboard or delete and recreate.'
        : 'No webhook found. Use POST method to create one.'
    })

  } catch (error) {
    console.error('[Webhook Check] Error:', error)
    return NextResponse.json({
      error: 'Failed to check webhooks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
