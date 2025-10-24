import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('[MIGRATION] Adding newsletter_id column to archived_newsletters...')

    // Check if column already exists
    const { data: columns, error: checkError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'archived_newsletters'
          AND column_name = 'newsletter_id';
        `
      })

    if (columns && columns.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Column already exists',
        note: 'newsletter_id column is already present in archived_newsletters table'
      })
    }

    // Add newsletter_id column
    const { error: addColumnError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          ALTER TABLE archived_newsletters
          ADD COLUMN newsletter_id TEXT;
        `
      })

    if (addColumnError) {
      throw new Error(`Failed to add column: ${addColumnError.message}`)
    }

    console.log('[MIGRATION] Column added, setting default values...')

    // Get the accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (newsletterError || !newsletter) {
      throw new Error('Failed to find accounting newsletter')
    }

    // Update existing records with the newsletter_id
    const { error: updateError } = await supabaseAdmin
      .from('archived_newsletters')
      .update({ newsletter_id: newsletter.id })
      .is('newsletter_id', null)

    if (updateError) {
      throw new Error(`Failed to update existing records: ${updateError.message}`)
    }

    console.log('[MIGRATION] Setting NOT NULL constraint...')

    // Make the column NOT NULL
    const { error: notNullError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          ALTER TABLE archived_newsletters
          ALTER COLUMN newsletter_id SET NOT NULL;
        `
      })

    if (notNullError) {
      console.warn('[MIGRATION] Could not set NOT NULL constraint:', notNullError.message)
      // Continue anyway - the column is added and populated
    }

    console.log('[MIGRATION] Creating index...')

    // Create index
    const { error: indexError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_archived_newsletters_newsletter_id
          ON archived_newsletters(newsletter_id);
        `
      })

    if (indexError) {
      console.warn('[MIGRATION] Could not create index:', indexError.message)
      // Continue anyway - the column is working
    }

    console.log('[MIGRATION] Migration complete!')

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      details: {
        newsletter_id: newsletter.id,
        column_added: true,
        records_updated: true,
        index_created: !indexError
      }
    })

  } catch (error: any) {
    console.error('[MIGRATION] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      note: 'You may need to run the migration SQL manually in Supabase SQL Editor'
    }, { status: 500 })
  }
}
