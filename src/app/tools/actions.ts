'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

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
  tagline?: string
  categoryIds: string[]
  plan: 'free' | 'monthly' | 'yearly'
}

/**
 * Add a new tool submission
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
      .from('tools_directory')
      .select('id')
      .eq('publication_id', PUBLICATION_ID)
      .eq('website_url', data.websiteUrl)
      .single()

    if (existingTool) {
      return { error: 'A tool with this website URL already exists' }
    }

    // Insert the tool
    const { data: tool, error: insertError } = await supabaseAdmin
      .from('tools_directory')
      .insert({
        publication_id: PUBLICATION_ID,
        tool_name: data.toolName,
        tagline: data.tagline || null,
        description: data.description,
        website_url: data.websiteUrl,
        tool_image_url: listingImageFileName ? `${SUPABASE_STORAGE_URL}${listingImageFileName}` : null,
        logo_image_url: logoImageFileName ? `${SUPABASE_STORAGE_URL}${logoImageFileName}` : null,
        clerk_user_id: clerkUserId,
        submitter_email: data.email,
        submitter_name: submitterName,
        submitter_image_url: submitterImageUrl,
        status: 'pending',
        plan: data.plan,
        is_sponsored: data.plan !== 'free'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Directory] Failed to insert tool:', insertError)
      return { error: insertError.message }
    }

    // Link categories
    if (tool && data.categoryIds.length > 0) {
      const categoryLinks = data.categoryIds.map(categoryId => ({
        category_id: categoryId,
        tool_id: tool.id
      }))

      const { error: linkError } = await supabaseAdmin
        .from('directory_categories_tools')
        .insert(categoryLinks)

      if (linkError) {
        console.error('[Directory] Failed to link categories:', linkError)
      }
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
 * Note: The webhook handler also updates the tool, but this provides a fallback
 * in case the webhook is delayed or fails
 */
export async function handlePaymentSuccess(toolId: string, plan: string) {
  // Check if already updated by webhook
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('is_sponsored, stripe_subscription_id')
    .eq('id', toolId)
    .single()

  // If webhook already processed this, just revalidate
  if (tool?.is_sponsored && tool?.stripe_subscription_id) {
    console.log('[Directory] Tool already updated by webhook')
    revalidatePath('/tools')
    return { error: null }
  }

  // Fallback update if webhook hasn't processed yet
  const { error } = await supabaseAdmin
    .from('tools_directory')
    .update({
      is_sponsored: true,
      plan: plan,
      sponsor_start_date: new Date().toISOString()
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
export async function approveTool(toolId: string) {
  const { error } = await supabaseAdmin
    .from('tools_directory')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to approve tool:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  revalidatePath('/tools/admin')
  return { error: null }
}

/**
 * Reject a tool (admin only)
 */
export async function rejectTool(toolId: string, reason: string) {
  const { error } = await supabaseAdmin
    .from('tools_directory')
    .update({
      status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to reject tool:', error)
    return { error: error.message }
  }

  revalidatePath('/tools/admin')
  return { error: null }
}

/**
 * Delete a tool (admin only)
 */
export async function deleteTool(toolId: string) {
  // First delete category links
  await supabaseAdmin
    .from('directory_categories_tools')
    .delete()
    .eq('tool_id', toolId)

  // Then delete the tool
  const { error } = await supabaseAdmin
    .from('tools_directory')
    .delete()
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to delete tool:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  revalidatePath('/tools/admin')
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

  if (data.toolName) updateData.tool_name = data.toolName
  if (data.description) updateData.description = data.description
  if (data.tagline !== undefined) updateData.tagline = data.tagline
  if (data.websiteUrl) updateData.website_url = data.websiteUrl
  if (data.email) updateData.submitter_email = data.email
  if (listingImageFileName) updateData.tool_image_url = `${SUPABASE_STORAGE_URL}${listingImageFileName}`
  if (logoImageFileName) updateData.logo_image_url = `${SUPABASE_STORAGE_URL}${logoImageFileName}`

  const { error: updateError } = await supabaseAdmin
    .from('tools_directory')
    .update(updateData)
    .eq('id', toolId)

  if (updateError) {
    console.error('[Directory] Failed to update tool:', updateError)
    return { error: updateError.message }
  }

  // Update categories if provided
  if (data.categoryIds) {
    // Remove existing links
    await supabaseAdmin
      .from('directory_categories_tools')
      .delete()
      .eq('tool_id', toolId)

    // Add new links
    if (data.categoryIds.length > 0) {
      const categoryLinks = data.categoryIds.map(categoryId => ({
        category_id: categoryId,
        tool_id: toolId
      }))

      await supabaseAdmin
        .from('directory_categories_tools')
        .insert(categoryLinks)
    }
  }

  revalidatePath('/tools')
  revalidatePath('/tools/admin')
  return { error: null }
}

/**
 * Toggle featured status (admin only)
 */
export async function toggleFeatured(toolId: string, isFeatured: boolean) {
  const { error } = await supabaseAdmin
    .from('tools_directory')
    .update({ is_featured: isFeatured })
    .eq('id', toolId)

  if (error) {
    console.error('[Directory] Failed to toggle featured:', error)
    return { error: error.message }
  }

  revalidatePath('/tools')
  return { error: null }
}
