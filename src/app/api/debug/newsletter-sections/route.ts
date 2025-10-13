import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Fetching all newsletter sections...')

    // Fetch ALL newsletter sections (not just active ones)
    const { data: allSections, error: allError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (allError) {
      throw allError
    }

    // Fetch only active sections
    const { data: activeSections, error: activeError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (activeError) {
      throw activeError
    }

    return NextResponse.json({
      success: true,
      total_sections: allSections?.length || 0,
      active_sections: activeSections?.length || 0,
      all_sections: allSections || [],
      active_sections_list: activeSections || [],
      message: `Found ${allSections?.length || 0} total sections, ${activeSections?.length || 0} active sections`
    })

  } catch (error) {
    console.error('Failed to fetch newsletter sections:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch newsletter sections',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}