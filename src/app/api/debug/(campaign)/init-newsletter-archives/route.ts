import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check if archived_newsletters table exists
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'archived_newsletters')
      .single()

    if (tables) {
      return NextResponse.json({
        success: true,
        message: 'archived_newsletters table already exists',
        action: 'none'
      })
    }

    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS archived_newsletters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issueId TEXT NOT NULL UNIQUE,
        issue_date DATE NOT NULL,
        subject_line TEXT NOT NULL,
        send_date TIMESTAMPTZ NOT NULL,
        recipient_count INTEGER DEFAULT 0,
        html_backup TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        articles JSONB DEFAULT '[]'::jsonb,
        events JSONB DEFAULT '[]'::jsonb,
        sections JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create index on issue_date for fast lookups by date
      CREATE INDEX IF NOT EXISTS idx_archived_newsletters_date
        ON archived_newsletters(issue_date DESC);

      -- Create index on send_date for archive list ordering
      CREATE INDEX IF NOT EXISTS idx_archived_newsletters_send_date
        ON archived_newsletters(send_date DESC);
    `

    const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
      sql: createTableSQL
    })

    if (createError) {
      // Fallback: try direct table creation (if RPC not available)
      console.log('RPC not available, table may need manual creation')
      return NextResponse.json({
        success: false,
        message: 'Table creation requires manual SQL execution',
        sql: createTableSQL,
        error: createError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'archived_newsletters table created successfully',
      action: 'created',
      note: 'Table includes indexes for fast date-based lookups'
    })

  } catch (error: any) {
    console.error('Error initializing newsletter archives:', error)
    return NextResponse.json({
      error: 'Failed to initialize newsletter archives',
      details: error.message,
      note: 'You may need to run the SQL manually in Supabase SQL Editor'
    }, { status: 500 })
  }
}
