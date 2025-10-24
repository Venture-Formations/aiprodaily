import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('[MIGRATION] Checking if newsletter_id column exists...')

    // Try to select the newsletter_id column to check if it exists
    const { data: testData, error: testError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('newsletter_id')
      .limit(1)

    // If no error, column exists
    if (!testError) {
      console.log('[MIGRATION] Column already exists')
      return NextResponse.json({
        success: true,
        message: 'Column already exists',
        note: 'newsletter_id column is already present in archived_newsletters table. You can now run the archive script.'
      })
    }

    // Column doesn't exist - provide manual migration instructions
    console.log('[MIGRATION] Column does not exist. Manual migration required.')

    const migrationSQL = `-- Add newsletter_id column to archived_newsletters table
ALTER TABLE archived_newsletters
ADD COLUMN IF NOT EXISTS newsletter_id TEXT;

-- Set default value for existing records (AI Accounting Daily)
UPDATE archived_newsletters
SET newsletter_id = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'
WHERE newsletter_id IS NULL;

-- Make the column NOT NULL
ALTER TABLE archived_newsletters
ALTER COLUMN newsletter_id SET NOT NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_archived_newsletters_newsletter_id
ON archived_newsletters(newsletter_id);`

    return NextResponse.json({
      success: false,
      error: 'Migration required',
      message: 'The newsletter_id column does not exist and must be added manually',
      instructions: [
        '1. Go to Supabase Dashboard > SQL Editor',
        '2. Create a new query',
        '3. Paste the SQL below',
        '4. Click "Run"',
        '5. Return here and run this endpoint again to verify'
      ],
      sql: migrationSQL,
      note: 'This is required because Supabase does not allow ALTER TABLE via the JavaScript client for security reasons'
    }, { status: 400 })

  } catch (error: any) {
    console.error('[MIGRATION] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration check failed',
      details: error.message
    }, { status: 500 })
  }
}
