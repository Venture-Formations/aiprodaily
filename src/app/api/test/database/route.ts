import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'test/database' },
  async () => {
    // Test database schema - check if new columns exist
    let columns = null
    let columnsError = null
    try {
      const result = await supabaseAdmin
        .rpc('get_columns', { table_name: 'publication_issues' })
      columns = result.data
      columnsError = result.error
    } catch (error) {
      columnsError = error
    }

    // Try a direct query to see what columns exist
    const { data: schemaTest, error: schemaError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, status, last_action, last_action_at, last_action_by')
      .limit(1)

    // Check status constraint
    const { data: constraintTest, error: constraintError } = await supabaseAdmin
      .from('publication_issues')
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
  }
)
