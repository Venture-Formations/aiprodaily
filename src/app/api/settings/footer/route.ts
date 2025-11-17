import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's publication_id (use first active newsletter for now)
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', newsletter.id)
      .in('key', ['logo_url', 'newsletter_name', 'business_name'])

    const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
    const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'AI Accounting Daily'
    const businessName = settings?.find(s => s.key === 'business_name')?.value || 'AI Accounting Daily'

    return NextResponse.json({
      logoUrl,
      newsletterName,
      businessName,
      currentYear: new Date().getFullYear()
    })
  } catch (error) {
    console.error('Failed to fetch footer settings:', error)
    return NextResponse.json({
      logoUrl: '/logo.png',
      newsletterName: 'AI Accounting Daily',
      businessName: 'AI Accounting Daily',
      currentYear: new Date().getFullYear()
    })
  }
}
