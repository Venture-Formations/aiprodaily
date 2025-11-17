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
      .select('value')
      .eq('key', 'header_image_url')
      .eq('publication_id', newsletter.id)
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
