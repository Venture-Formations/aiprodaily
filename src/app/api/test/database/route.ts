import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Check if secret parameter is provided
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test database schema - check if new columns exist
    let columns = null
    let columnsError = null
    try {
      const result = await supabaseAdmin
        .rpc('get_columns', { table_name: 'newsletter_campaigns' })
      columns = result.data
      columnsError = result.error
    } catch (error) {
      columnsError = error
    }

    // Try a direct query to see what columns exist
    const { data: schemaTest, error: schemaError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, status, last_action, last_action_at, last_action_by')
      .limit(1)

    // Check status constraint
    const { data: constraintTest, error: constraintError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('status')
      .eq('status', 'changes_made')
      .limit(1)

    return NextResponse.json({
      success: true,
      tests: {
        schema_test: {
          error: schemaError?.message || null,
          success: !schemaError
        },
        constraint_test: {
          error: constraintError?.message || null,
          success: !constraintError
        },
        columns: columns || 'RPC not available'
      },
      migration_needed: !!schemaError || !!constraintError,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}