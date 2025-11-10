import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Setting up advertisements database schema...')

    // Check if tables already exist
    const { data: existingTables, error: checkError } = await supabaseAdmin
      .from('advertisements')
      .select('id')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        error: 'Tables already exist',
        message: 'Advertisements tables are already set up. Use the SQL script to modify the schema if needed.'
      }, { status: 400 })
    }

    // Read and execute the migration SQL
    const fs = require('fs')
    const path = require('path')
    const sqlPath = path.join(process.cwd(), 'database_migration_advertisements.sql')

    const sql = fs.readFileSync(sqlPath, 'utf-8')

    // Execute SQL (Supabase admin can run raw SQL)
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql })

    if (error) {
      console.error('Migration error:', error)
      return NextResponse.json({
        error: 'Failed to run migration',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement tables created successfully',
      instructions: [
        '1. Tables created: advertisements, campaign_advertisements, ad_pricing_tiers',
        '2. Default pricing tiers added',
        '3. Community Business Spotlight section added to newsletter',
        '4. You can now configure pricing in Settings > Ads'
      ]
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error',
      note: 'You may need to run the SQL script manually in Supabase SQL Editor'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to set up advertisement tables',
    note: 'Or run database_migration_advertisements.sql manually in Supabase SQL Editor'
  })
}
