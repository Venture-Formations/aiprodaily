import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { declareRoute } from '@/lib/auth-tiers'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routeConfig = declareRoute({
  authTier: 'admin',
  description: 'Admin tools management'
})

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

export async function GET(request: NextRequest) {
  // Check if staging environment (bypass auth)
  const host = request.headers.get('host') || ''
  const isStaging = host.includes('localhost') ||
                    host.includes('staging') ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging'

  if (!isStaging) {
    // Check admin authentication in production
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS?.split(',') || []
    if (!allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

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
    console.error('[Tools Admin] Error fetching tools:', error)
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
