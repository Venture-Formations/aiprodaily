import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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
