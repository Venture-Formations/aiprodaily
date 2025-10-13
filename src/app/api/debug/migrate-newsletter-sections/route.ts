import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Running newsletter sections migration...')

    const sectionsToAdd = [
      { name: "Yesterday's Wordle", display_order: 40, is_active: true },
      { name: 'Minnesota Getaways', display_order: 50, is_active: true },
      { name: 'Dining Deals', display_order: 60, is_active: true }
    ]

    // Add missing sections
    for (const section of sectionsToAdd) {
      // Check if section already exists
      const { data: existing } = await supabaseAdmin
        .from('newsletter_sections')
        .select('id')
        .eq('name', section.name)
        .single()

      if (!existing) {
        console.log(`Adding section: ${section.name}`)
        const { error } = await supabaseAdmin
          .from('newsletter_sections')
          .insert([section])

        if (error) {
          console.error(`Error adding ${section.name}:`, error.message)
        }
      } else {
        console.log(`Section already exists: ${section.name}`)
      }
    }

    // Update display orders to ensure proper spacing and ordering
    const updates = [
      { name: 'The Local Scoop', order: 10 },
      { name: 'Local Events', order: 20 },
      { name: 'Local Weather', order: 30 },
      { name: 'Yesterday\'s Wordle', order: 40 },
      { name: 'Minnesota Getaways', order: 50 },
      { name: 'Dining Deals', order: 60 }
    ]

    for (const update of updates) {
      await supabaseAdmin
        .from('newsletter_sections')
        .update({ display_order: update.order })
        .eq('name', update.name)
        .neq('display_order', update.order)
    }

    // Get final configuration
    const { data: sections, error: selectError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .order('display_order', { ascending: true })

    if (selectError) {
      throw selectError
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter sections migration completed successfully',
      sections: sections || []
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}