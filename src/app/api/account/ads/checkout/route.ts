import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

// Initialize Stripe lazily to avoid build errors when env var is missing
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Pricing constants (must match frontend)
const PRICE_PER_DAY = 250
const DISCOUNTED_PRICE_PER_DAY = 200
const DISCOUNT_THRESHOLD = 4

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      companyName,
      headline,
      description,
      destinationUrl,
      buttonText,
      selectedDates,
      useNextAvailable,
      nextAvailableDays,
      numDays,
    } = body

    // Validate
    if (!companyName || !headline || !description || !destinationUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (numDays < 1) {
      return NextResponse.json({ error: 'At least one day must be selected' }, { status: 400 })
    }

    // Calculate price server-side (don't trust client)
    const hasDiscount = numDays >= DISCOUNT_THRESHOLD
    const pricePerDay = hasDiscount ? DISCOUNTED_PRICE_PER_DAY : PRICE_PER_DAY
    const total = numDays * pricePerDay

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null

    // Check if user already has a Stripe customer ID in our database
    const { data: existingTool } = await supabaseAdmin
      .from('tools_directory')
      .select('stripe_customer_id')
      .eq('clerk_user_id', user.id)
      .single()

    if (existingTool?.stripe_customer_id) {
      stripeCustomerId = existingTool.stripe_customer_id
    } else {
      // Create new Stripe customer
      const stripe = getStripe()
      const customer = await stripe.customers.create({
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName || undefined,
        metadata: {
          clerk_user_id: user.id,
        },
      })
      stripeCustomerId = customer.id
    }

    // Create the ad record in database (status: pending_payment)
    const { data: ad, error: adError } = await supabaseAdmin
      .from('advertisements')
      .insert({
        clerk_user_id: user.id,
        company_name: companyName,
        title: headline,
        description: description,
        url: destinationUrl,
        button_text: buttonText,
        ad_type: 'main_sponsor',
        status: 'pending_payment',
        use_next_available: useNextAvailable,
        next_available_days: useNextAvailable ? nextAvailableDays : null,
        total_amount: total,
        num_days: numDays,
      })
      .select('id')
      .single()

    if (adError) {
      console.error('[Checkout] Failed to create ad:', adError)
      return NextResponse.json({ error: 'Failed to create ad record' }, { status: 500 })
    }

    // Store selected dates if not using next available
    if (!useNextAvailable && selectedDates && selectedDates.length > 0) {
      const dateRecords = selectedDates.map((date: string) => ({
        advertisement_id: ad.id,
        scheduled_date: date,
        status: 'pending',
      }))

      const { error: datesError } = await supabaseAdmin
        .from('advertisement_dates')
        .insert(dateRecords)

      if (datesError) {
        console.error('[Checkout] Failed to store dates:', datesError)
        // Don't fail the whole request, admin can fix manually
      }
    }

    // Create Stripe checkout session
    const stripeClient = getStripe()
    const session = await stripeClient.checkout.sessions.create({
      customer: stripeCustomerId || undefined,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Newsletter Main Sponsor Ad',
              description: `${numDays} day${numDays > 1 ? 's' : ''} of newsletter sponsorship${hasDiscount ? ' (volume discount applied)' : ''}`,
            },
            unit_amount: total * 100, // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/ads/newsletter?success=true&ad_id=${ad.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account/ads/new?cancelled=true`,
      metadata: {
        advertisement_id: ad.id,
        clerk_user_id: user.id,
        num_days: numDays.toString(),
        ad_type: 'main_sponsor',
      },
    })

    // Update ad with checkout session ID
    await supabaseAdmin
      .from('advertisements')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', ad.id)

    return NextResponse.json({ checkoutUrl: session.url })

  } catch (error) {
    console.error('[Checkout] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

