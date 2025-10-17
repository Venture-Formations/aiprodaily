import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Skip auth check in development (localhost)
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // AI Applications count
    const { data: aiAppsCount, error: aiAppsError } = await supabaseAdmin
      .from('ai_applications')
      .select('id', { count: 'exact' })

    if (aiAppsError) {
      console.error('Error fetching AI applications count:', aiAppsError)
    }

    // Prompt Ideas count
    const { data: promptsCount, error: promptsError } = await supabaseAdmin
      .from('prompt_ideas')
      .select('id', { count: 'exact' })

    if (promptsError) {
      console.error('Error fetching prompt ideas count:', promptsError)
    }

    // Advertisements count
    const { data: adsCount, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select('id', { count: 'exact' })

    if (adsError) {
      console.error('Error fetching Ads count:', adsError)
    }

    const databases = [
      {
        name: 'AI Applications',
        description: 'AI tools and applications for accountants',
        count: aiAppsCount?.length || 0,
        href: '/dashboard/databases/ai-apps'
      },
      {
        name: 'Prompt Ideas',
        description: 'AI prompts and templates for accounting tasks',
        count: promptsCount?.length || 0,
        href: '/dashboard/databases/prompt-ideas'
      },
      {
        name: 'Advertisements',
        description: 'Newsletter advertisement submissions',
        count: adsCount?.length || 0,
        href: '/dashboard/databases/ads'
      }
    ]

    return NextResponse.json({ databases })
  } catch (error) {
    console.error('Database stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}