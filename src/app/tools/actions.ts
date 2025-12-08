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

export interface AddToolData {
  toolName: string
  email: string
  websiteUrl: string
  description: string
  category: AIAppCategory
  plan: 'free' | 'monthly' | 'yearly'
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
        is_featured: false,
        is_paid_placement: data.plan !== 'free',
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
 * Create Stripe checkout session for sponsored listing
 */
export async function createCheckoutSession(
  toolId: string,
  plan: 'monthly' | 'yearly'
): Promise<string | null> {
  if (!stripe) {
    console.error('[Directory] Stripe not configured')
    return null
  }

  const priceId = plan === 'monthly'
    ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY
    : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY

  if (!priceId) {
    console.error('[Directory] Stripe price ID not configured')
    return null
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      // Include tool_id and plan in metadata for webhook processing
      metadata: {
        tool_id: toolId,
        plan: plan
      },
      success_url: `${baseUrl}/tools/success?tool_id=${toolId}&plan=${plan}`,
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
export async function handlePaymentSuccess(toolId: string, plan: string) {
  // Check if already updated by webhook
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('is_paid_placement, sponsor_start_date')
    .eq('id', toolId)
    .single()

  // If webhook already processed this, just revalidate
  if (tool?.is_paid_placement && tool?.sponsor_start_date) {
    console.log('[Directory] Tool already updated by webhook')
    revalidatePath('/tools')
    return { error: null }
  }

  // Calculate sponsor end date based on plan
  const sponsorStartDate = new Date()
  const sponsorEndDate = new Date(sponsorStartDate)
  if (plan === 'yearly') {
    sponsorEndDate.setFullYear(sponsorEndDate.getFullYear() + 1)
  } else {
    sponsorEndDate.setMonth(sponsorEndDate.getMonth() + 1)
  }

  // Fallback update if webhook hasn't processed yet
  const { error } = await supabaseAdmin
    .from('ai_applications')
    .update({
      is_paid_placement: true,
      plan: plan as 'monthly' | 'yearly',
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
