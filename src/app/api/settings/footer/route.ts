import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
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
