import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Allow both GET and POST for convenience
export async function GET(request: NextRequest) {
  return handleFixQuotedSettings()
}

export async function POST(request: NextRequest) {
  return handleFixQuotedSettings()
}

async function handleFixQuotedSettings() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching all publication_settings...')

    const { data: settings, error } = await supabaseAdmin
      .from('publication_settings')
      .select('id, key, value')

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`Found ${settings?.length || 0} settings`)

    const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []

    for (const setting of settings || []) {
      if (setting.value &&
          setting.value.startsWith('"') &&
          setting.value.endsWith('"') &&
          setting.value.length > 2) {
        const newValue = setting.value.slice(1, -1)
        updates.push({
          id: setting.id,
          key: setting.key,
          oldValue: setting.value,
          newValue
        })
      }
    }

    console.log(`Found ${updates.length} settings with extra quotes`)

    if (updates.length === 0) {
      return NextResponse.json({
        message: 'No settings need fixing!',
        totalSettings: settings?.length || 0,
        fixedCount: 0
      })
    }

    let fixedCount = 0
    for (const update of updates) {
      console.log(`Fixing ${update.key}: ${update.oldValue} -> ${update.newValue}`)
      const { error: updateError } = await supabaseAdmin
        .from('publication_settings')
        .update({ value: update.newValue, updated_at: new Date().toISOString() })
        .eq('id', update.id)

      if (updateError) {
        console.error(`Error updating ${update.key}:`, updateError)
      } else {
        fixedCount++
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedCount} settings`,
      totalSettings: settings?.length || 0,
      fixedCount,
      updates: updates.map(u => ({ key: u.key, old: u.oldValue, new: u.newValue }))
    })

  } catch (error) {
    console.error('Error in fix-quoted-settings:', error)
    return NextResponse.json({
      error: 'Failed to fix settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

