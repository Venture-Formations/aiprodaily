'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import type { AIAppCategory } from '@/types/database'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'
// Use SUPABASE_URL (server-side) instead of NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_STORAGE_URL = `${process.env.SUPABASE_URL}/storage/v1/object/public/tool-images/`

// Initialize Stripe if key exists
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

// Pricing constants (in cents for Stripe, display in dollars)
const PRICING = {
  paid_placement_monthly: 30,
  paid_placement_yearly: 300, // 10 months (2 free)
  featured_monthly: 60,
  featured_yearly: 600, // 10 months (2 free)
}

// Listing types
type ListingType = 'free' | 'paid_placement' | 'featured'
type BillingPeriod = 'monthly' | 'yearly'

export interface AddToolData {
  toolName: string
  email: string
  websiteUrl: string
  description: string
  category: AIAppCategory
  plan: string // Legacy field, will be derived from listingType + billingPeriod
  listingType?: ListingType
  billingPeriod?: BillingPeriod
}

/**
 * Add a new tool submission - inserts into ai_applications
 */
export async function addTool(
  data: AddToolData,
  clerkUserId: string | null,
  listingImageFileName: string,
  submitterName: string,
  submitterImageUrl: string,
  logoImageFileName?: string
) {
  try {
    // Check if tool already exists
    const { data: existingTool } = await supabaseAdmin
      .from('ai_applications')
      .select('id')
      .eq('publication_id', PUBLICATION_ID)
      .eq('app_url', data.websiteUrl)
      .single()

    if (existingTool) {
      return { error: 'A tool with this website URL already exists' }
    }

    // Determine listing type and featured status
    const listingType = data.listingType || 'free'
    const isFeatured = listingType === 'featured'
    const isPaidPlacement = listingType === 'paid_placement'

    // Insert the tool into ai_applications
    const { data: tool, error: insertError } = await supabaseAdmin
      .from('ai_applications')
      .insert({
        publication_id: PUBLICATION_ID,
        app_name: data.toolName,
        description: data.description,
        category: data.category,
        app_url: data.websiteUrl,
        screenshot_url: listingImageFileName ? `${SUPABASE_STORAGE_URL}${listingImageFileName}` : null,
        logo_url: logoImageFileName ? `${SUPABASE_STORAGE_URL}${logoImageFileName}` : null,
        is_active: false, // Pending review
        is_featured: isFeatured,
        is_paid_placement: isPaidPlacement,
        is_affiliate: false,
        tool_type: 'Client',
        category_priority: 0,
        times_used: 0,
        // New submission fields
        clerk_user_id: clerkUserId,
        submitter_email: data.email,
        submitter_name: submitterName,
        submitter_image_url: submitterImageUrl,
        submission_status: 'pending',
        plan: data.plan,
        listing_type: listingType,
        billing_period: data.billingPeriod || null,
        view_count: 0,
        click_count: 0
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Directory] Failed to insert tool:', insertError)
      return { error: insertError.message }
    }

    revalidatePath('/tools')
    return { tool, error: null }
  } catch (err) {
    console.error('[Directory] Error adding tool:', err)
    return { error: 'Failed to add tool' }
  }
}

/**
 * Claim an existing unclaimed tool - updates the ai_applications record
 * Sets the clerk_user_id and puts the tool back to pending status for review
 */
export async function claimTool(
  toolId: string,
  data: {
    toolName: string
    email: string
    websiteUrl: string
    description: string
    category: AIAppCategory
  },
  clerkUserId: string | null,
  listingImageFileName?: string,
  submitterName?: string,
  submitterImageUrl?: string,
  logoImageFileName?: string,
  keepExistingLogo?: boolean,
  keepExistingImage?: boolean
) {
  try {
    if (!clerkUserId) {
      return { error: 'You must be signed in to claim a listing' }
    }

    // Check if the tool exists and is unclaimed
    const { data: existingTool, error: fetchError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, clerk_user_id, app_name')
      .eq('id', toolId)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (fetchError || !existingTool) {
      return { error: 'Tool not found' }
    }

    if (existingTool.clerk_user_id) {
      return { error: 'This listing has already been claimed' }
    }

    // Check if user already has a listing
    const { data: userListing } = await supabaseAdmin
      .from('ai_applications')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .eq('publication_id', PUBLICATION_ID)
      .single()

    if (userListing) {
      return { error: 'You already have a listing. You can only manage one listing at a time.' }
    }

    // Build update object
    const updateData: Record<string, any> = {
      app_name: data.toolName,
      description: data.description,
      category: data.category,
      app_url: data.websiteUrl,
      clerk_user_id: clerkUserId,
      submitter_email: data.email,
      submitter_name: submitterName || null,
      submitter_image_url: submitterImageUrl || null,
      // Reset to pending for re-review
      is_active: false,
      submission_status: 'pending',
      // Reset payment/featured status - they'll need to upgrade after claiming
      is_featured: false,
      is_paid_placement: false,
      plan: 'free'
    }

    // Handle logo image
    if (logoImageFileName) {
      updateData.logo_url = `${SUPABASE_STORAGE_URL}${logoImageFileName}`
    } else if (!keepExistingLogo) {
      updateData.logo_url = null
    }

    // Handle listing image
    if (listingImageFileName) {
      updateData.screenshot_url = `${SUPABASE_STORAGE_URL}${listingImageFileName}`
    } else if (!keepExistingImage) {
      updateData.screenshot_url = null
    }

    // Update the tool
    const { error: updateError } = await supabaseAdmin
      .from('ai_applications')
      .update(updateData)
      .eq('id', toolId)

    if (updateError) {
      console.error('[Directory] Failed to claim tool:', updateError)
      return { error: updateError.message }
    }

    revalidatePath('/tools')
    revalidatePath(`/tools/${toolId}`)
    revalidatePath('/account')
    return { error: null }
  } catch (err) {
    console.error('[Directory] Error claiming tool:', err)
    return { error: 'Failed to claim tool' }
  }
}

/**
 * Create Stripe checkout session for paid listing
 */
export async function createCheckoutSession(
  toolId: string,
  listingType: ListingType,
  billingPeriod: BillingPeriod
): Promise<string | null> {
  if (!stripe) {
    console.error('[Directory] Stripe not configured')
    return null
  }

  // Determine the correct price ID based on listing type and billing period
  const priceKey = `${listingType}_${billingPeriod}` as keyof typeof PRICING
  const amount = PRICING[priceKey]

  if (!amount) {
    console.error('[Directory] Invalid listing type or billing period')
    return null
  }

  // Get the appropriate Stripe price ID from env vars
  // Format: STRIPE_PRICE_PAID_PLACEMENT_MONTHLY, STRIPE_PRICE_FEATURED_YEARLY, etc.
  const priceEnvKey = `STRIPE_PRICE_${listingType.toUpperCase()}_${billingPeriod.toUpperCase()}`
  const priceId = process.env[priceEnvKey]

  // If no specific price ID, try the legacy ones
  const legacyPriceId = billingPeriod === 'monthly'
    ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY
    : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY

  const finalPriceId = priceId || legacyPriceId

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // If we have a price ID (subscription), use that
    if (finalPriceId) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: finalPriceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        metadata: {
          tool_id: toolId,
          listing_type: listingType,
          billing_period: billingPeriod
        },
        success_url: `${baseUrl}/tools/success?tool_id=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`,
        cancel_url: `${baseUrl}/tools/submit`
      })

      return session.url
    }

    // Fallback: Create a one-time payment session with price_data
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${listingType === 'featured' ? 'Featured' : 'Paid Placement'} Listing (${billingPeriod})`,
              description: `AI Tools Directory ${listingType === 'featured' ? 'Featured' : 'Paid Placement'} listing`
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
        billing_period: billingPeriod
      },
      success_url: `${baseUrl}/tools/success?tool_id=${toolId}&listing_type=${listingType}&billing_period=${billingPeriod}`,
      cancel_url: `${baseUrl}/tools/submit`
    })

    return session.url
  } catch (err) {
    console.error('[Directory] Stripe checkout error:', err)
    return null
  }
}

/**
 * Handle successful payment - update tool status
 */
export async function handlePaymentSuccess(
  toolId: string,
  listingType: string,
  billingPeriod: string
) {
  // Check if already updated by webhook
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('is_paid_placement, is_featured, sponsor_start_date')
    .eq('id', toolId)
    .single()

  // If webhook already processed this, just revalidate
  if (tool?.sponsor_start_date && (tool?.is_paid_placement || tool?.is_featured)) {
    console.log('[Directory] Tool already updated by webhook')
    revalidatePath('/tools')
    return { error: null }
  }

  // Calculate sponsor end date based on billing period
  const sponsorStartDate = new Date()
  const sponsorEndDate = new Date(sponsorStartDate)
  if (billingPeriod === 'yearly') {
    sponsorEndDate.setFullYear(sponsorEndDate.getFullYear() + 1)
  } else {
    sponsorEndDate.setMonth(sponsorEndDate.getMonth() + 1)
  }

  // Fallback update if webhook hasn't processed yet
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .update({
      is_paid_placement: listingType === 'paid_placement',
      is_featured: listingType === 'featured',
      listing_type: listingType,
      billing_period: billingPeriod,
      sponsor_start_date: sponsorStartDate.toISOString(),
      sponsor_end_date: sponsorEndDate.toISOString()
    })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to update tool after payment:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  return { error: null }
}

/**
 * Approve a tool (admin only)
 */
export async function approveTool(toolId: string, approvedBy?: string) {
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .update({
      is_active: true,
      submission_status: 'approved',
      approved_by: approvedBy || null,
      approved_at: new Date().toISOString()
    })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to approve tool:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  revalidatePath('/dashboard/accounting/tools-admin')
  return { error: null }
}

/**
 * Reject a tool (admin only) - sets is_active to false
 */
export async function rejectTool(toolId: string, reason: string) {
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .update({
      is_active: false,
      submission_status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to reject tool:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard/accounting/tools-admin')
  return { error: null }
}

/**
 * Delete a tool (admin only)
 */
export async function deleteTool(toolId: string) {
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .delete()
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to delete tool:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  revalidatePath('/dashboard/accounting/tools-admin')
  return { error: null }
}

/**
 * Update a tool (admin only)
 */
export async function updateTool(
  toolId: string,
  data: Partial<AddToolData>,
  listingImageFileName?: string,
  logoImageFileName?: string
) {
  const updateData: Record<string, any> = {}

  if (data.toolName) updateData.app_name = data.toolName
  if (data.description) updateData.description = data.description
  if (data.category) updateData.category = data.category
  if (data.websiteUrl) updateData.app_url = data.websiteUrl
  if (listingImageFileName) updateData.screenshot_url = `${SUPABASE_STORAGE_URL}${listingImageFileName}`
  if (logoImageFileName) updateData.logo_url = `${SUPABASE_STORAGE_URL}${logoImageFileName}`

  const { error: updateError } = await supabaseAdmin
    .from('ai_applications')
    .update(updateData)
    .eq('id', toolId)

  if (updateError) {
    console.error('[Directory] Failed to update tool:', updateError)
    return { error: updateError.message }
  }

  revalidatePath('/tools')
  revalidatePath('/dashboard/accounting/tools-admin')
  return { error: null }
}

/**
 * Toggle featured status (admin only)
 */
export async function toggleFeatured(toolId: string, isFeatured: boolean) {
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .update({ is_featured: isFeatured })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to toggle featured:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  return { error: null }
}
