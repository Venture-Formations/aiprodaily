import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'header_image_url')
      .single()

    return NextResponse.json({
      success: true,
      headerImageUrl: settings?.value || '/logo.png'
    })
  } catch (error: any) {
    console.error('Error fetching header image:', error)
    return NextResponse.json(
      { error: 'Failed to fetch header image', headerImageUrl: '/logo.png' },
      { status: 500 }
    )
  }
}
