import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

// Lazy initialize Stripe to avoid build-time errors
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }

    const stripe = getStripe()

    // Get or create Stripe customer for this user
    let customerId: string | null = null

    // Check if user has a Stripe customer ID in their tools or ads
    const { data: tool } = await supabaseAdmin
      .from('tools_directory')
      .select('stripe_customer_id')
      .eq('clerk_user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single()

    if (tool?.stripe_customer_id) {
      customerId = tool.stripe_customer_id
    }

    // If no customer found, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || undefined,
        metadata: {
          clerk_user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://aiaccountingdaily.com'}/account/billing`,
    })

    return NextResponse.redirect(session.url)

  } catch (error) {
    console.error('Billing portal error:', error)
    // If there's an error (e.g., no Stripe customer), redirect back with error
    return NextResponse.redirect(
      new URL('/account/billing?error=Unable to open billing portal. Please contact support.', request.url)
    )
  }
}

