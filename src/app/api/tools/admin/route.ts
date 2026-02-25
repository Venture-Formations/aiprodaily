import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// Categories mapping for ai_applications
const CATEGORIES = [
  { id: 'payroll', name: 'Payroll', slug: 'payroll' },
  { id: 'hr', name: 'HR', slug: 'hr' },
  { id: 'accounting-system', name: 'Accounting System', slug: 'accounting-system' },
  { id: 'finance', name: 'Finance', slug: 'finance' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management' },
  { id: 'banking', name: 'Banking', slug: 'banking' }
]

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/admin' },
  async ({ request, logger }) => {
    const status = request.nextUrl.searchParams.get('status') || 'pending'
    const submittedOnly = request.nextUrl.searchParams.get('submitted_only') !== 'false'

    // Query ai_applications table
    let query = supabaseAdmin
      .from('ai_applications')
      .select('*')
      .order('created_at', { ascending: false })

    // By default, only show submitted tools (those with clerk_user_id set)
    if (submittedOnly) {
      query = query.not('clerk_user_id', 'is', null)
    }

    // Map status filter - ai_applications uses submission_status
    if (status !== 'all') {
      query = query.eq('submission_status', status)
    }

    const { data: apps, error } = await query

    if (error) {
      logger.error({ err: error }, 'Error fetching tools')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform ai_applications data to match the expected Tool format
    const transformedTools = (apps || []).map(app => ({
      id: app.id,
      tool_name: app.app_name,
      tagline: null,
      description: app.description,
      website_url: app.app_url,
      tool_image_url: app.screenshot_url,
      logo_image_url: app.logo_url,
      status: app.submission_status || 'pending',
      plan: app.plan || 'free',
      is_sponsored: app.is_paid_placement || false,
      is_featured: app.is_featured || false,
      submitter_email: app.submitter_email || '',
      submitter_name: app.submitter_name || null,
      created_at: app.created_at,
      rejection_reason: app.rejection_reason || null,
      categories: app.category
        ? [CATEGORIES.find(c => c.name === app.category) || { id: 'other', name: app.category, slug: 'other' }]
        : []
    }))

    return NextResponse.json({ success: true, tools: transformedTools })
  }
)
