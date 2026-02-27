import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import { getPublicationByDomain } from '@/lib/publication-settings'
import { PUBLICATION_ID } from '@/lib/config'

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

// Pricing in dollars
const PRICING = {
  paid_placement_monthly: 30,
  paid_placement_yearly: 300,
  featured_monthly: 60,
  featured_yearly: 600,
}

type ListingType = 'paid_placement' | 'featured'
type BillingPeriod = 'monthly' | 'yearly'

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!stripe) {
      console.error('[Checkout] Stripe not configured')
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 })
    }

    // Resolve publication from request host
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const publicationId = await getPublicationByDomain(host) || PUBLICATION_ID

    const body = await request.json()
    const { toolId, listingType, billingPeriod } = body as {
      toolId: string
      listingType: ListingType
      billingPeriod: BillingPeriod
    }

    // Validate inputs
    if (!toolId || !listingType || !billingPeriod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['paid_placement', 'featured'].includes(listingType)) {
      return NextResponse.json({ error: 'Invalid listing type' }, { status: 400 })
    }

    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 })
    }

    // Verify the tool belongs to this user
    const { data: tool, error: fetchError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, clerk_user_id, category, is_featured, submission_status')
      .eq('id', toolId)
      .eq('publication_id', publicationId)
      .single()

    if (fetchError || !tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
    }

    if (tool.clerk_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if tool is approved
    if (tool.submission_status !== 'approved' && tool.submission_status !== 'edited') {
      return NextResponse.json({ error: 'Tool must be approved before upgrading' }, { status: 400 })
    }

    // If trying to get featured, check if category already has a featured tool
    if (listingType === 'featured' && !tool.is_featured) {
      const { data: existingFeatured } = await supabaseAdmin
        .from('ai_applications')
        .select('id')
        .eq('publication_id', publicationId)
        .eq('category', tool.category)
        .eq('is_featured', true)
        .neq('id', toolId)
        .single()

      if (existingFeatured) {
        return NextResponse.json({
          error: 'This category already has a featured tool'
        }, { status: 400 })
      }
    }

    // Get the price
    const priceKey = `${listingType}_${billingPeriod}` as keyof typeof PRICING
    const amount = PRICING[priceKey]

    // Get the appropriate Stripe price ID from env vars
    const priceEnvKey = `STRIPE_PRICE_${listingType.toUpperCase()}_${billingPeriod.toUpperCase()}`
    const priceId = process.env[priceEnvKey]

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe checkout session
    let session: Stripe.Checkout.Session

    if (priceId) {
      // Use pre-configured price ID (subscription)
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: user.emailAddresses[0]?.emailAddress,
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        metadata: {
          tool_id: toolId,
          listing_type: listingType,
          billing_period: billingPeriod,
          clerk_user_id: user.id,
          source: 'ai_applications',
          publication_id: publicationId
        },
        success_url: `${baseUrl}/account/ads/upgrade/success?tool_id=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`,
        cancel_url: `${baseUrl}/account/ads/upgrade?tool=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`
      })
    } else {
      // Create dynamic price (subscription)
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: user.emailAddresses[0]?.emailAddress,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${listingType === 'featured' ? 'Featured' : 'Paid Placement'} Listing`,
                description: `AI Tools Directory ${listingType === 'featured' ? 'Featured' : 'Paid Placement'} listing for ${tool.app_name}`
              },
              unit_amount: amount * 100, // Convert to cents
              recurring: {
                interval: billingPeriod === 'monthly' ? 'month' : 'year'
              }
            },
            quantity: 1
          }
        ],
        mode: 'subscription',
        metadata: {
          tool_id: toolId,
          listing_type: listingType,
          billing_period: billingPeriod,
          clerk_user_id: user.id,
          source: 'ai_applications',
          publication_id: publicationId
        },
        success_url: `${baseUrl}/account/ads/upgrade/success?tool_id=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`,
        cancel_url: `${baseUrl}/account/ads/upgrade?tool=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`
      })
    }

    return NextResponse.json({ url: session.url })

  } catch (error) {
    console.error('[Checkout] Error creating checkout session:', error)
    return NextResponse.json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
