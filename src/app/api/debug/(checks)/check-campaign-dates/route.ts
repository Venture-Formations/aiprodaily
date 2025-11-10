import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return NextResponse.json({
      campaigns: campaigns?.map(c => ({
        id: c.id,
        date: c.date,
        created_at: c.created_at,
        status: c.status,
        dates_match: c.date === c.created_at?.split('T')[0]
      }))
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check campaign dates',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
