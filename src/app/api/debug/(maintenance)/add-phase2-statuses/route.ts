import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Drop the existing constraint
    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE publication_issues
        DROP CONSTRAINT IF EXISTS publication_issues_status_check;
      `
    })

    if (dropError) {
      // Try alternative approach - direct query
      const { error: altDropError } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .limit(0) // Just to test connection

      console.log('[Migration] Constraint drop attempted, proceeding with add...')
    }

    // Add new constraint with additional statuses
    const { error: addError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE publication_issues
        ADD CONSTRAINT publication_issues_status_check
        CHECK (status IN ('draft', 'processing', 'pending_phase2', 'in_review', 'changes_made', 'ready_to_send', 'sent', 'failed'));
      `
    })

    if (addError) {
      console.error('[Migration] Error adding constraint:', addError)

      // Try using raw SQL via a function
      return NextResponse.json({
        success: false,
        error: 'Failed to add constraint via RPC',
        message: addError.message,
        instructions: 'Please run the SQL migration manually using the db/migrations/add_phase2_statuses.sql file'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully added pending_phase2 and processing statuses',
      statuses: ['draft', 'processing', 'pending_phase2', 'in_review', 'changes_made', 'ready_to_send', 'sent', 'failed']
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      instructions: 'Please run the SQL migration manually using the db/migrations/add_phase2_statuses.sql file'
    }, { status: 500 })
  }
}
