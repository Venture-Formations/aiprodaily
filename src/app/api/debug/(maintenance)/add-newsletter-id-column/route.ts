import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 600

/**
 * Adds publication_id column to app_settings table.
 * This enables newsletter-specific settings for multi-tenant support.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[ADD-COLUMN] Adding publication_id column to app_settings table...')

    // Add publication_id column as UUID with foreign key to newsletters table
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Add publication_id column if it doesn't exist
        ALTER TABLE app_settings
        ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES newsletters(id);

        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_app_settings_publication_id
        ON app_settings(publication_id);

        -- Create index for combined key + publication_id lookups
        CREATE INDEX IF NOT EXISTS idx_app_settings_key_publication_id
        ON app_settings(key, publication_id);
      `
    })

    if (alterError) {
      console.error('[ADD-COLUMN] Error:', alterError)

      // If RPC doesn't exist, return SQL for manual execution
      return NextResponse.json({
        success: false,
        error: 'Could not execute SQL automatically',
        message: 'Please run this SQL manually in Supabase SQL Editor:',
        sql: `
-- Add publication_id column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES newsletters(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_app_settings_publication_id
ON app_settings(publication_id);

CREATE INDEX IF NOT EXISTS idx_app_settings_key_publication_id
ON app_settings(key, publication_id);
        `.trim()
      }, { status: 500 })
    }

    console.log('[ADD-COLUMN] ✓ Column added successfully')

    return NextResponse.json({
      success: true,
      message: 'publication_id column added to app_settings table',
      details: {
        column: 'publication_id',
        type: 'UUID',
        nullable: true,
        foreignKey: 'newsletters(id)',
        indexes: [
          'idx_app_settings_publication_id',
          'idx_app_settings_key_publication_id'
        ]
      },
      nextStep: 'Run /api/debug/migrate-criteria-settings to assign publication_id to existing settings'
    })

  } catch (error: any) {
    console.error('[ADD-COLUMN] Error:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Please run this SQL manually in Supabase SQL Editor:',
      sql: `
-- Add publication_id column to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES newsletters(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_app_settings_publication_id
ON app_settings(publication_id);

CREATE INDEX IF NOT EXISTS idx_app_settings_key_publication_id
ON app_settings(key, publication_id);
      `.trim()
    }, { status: 500 })
  }
}
