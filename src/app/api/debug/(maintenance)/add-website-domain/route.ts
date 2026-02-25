import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/add-website-domain' },
  async ({ logger }) => {
  try {
    // Add website_domain column to newsletters table
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE newsletters
        ADD COLUMN IF NOT EXISTS website_domain TEXT;
      `
    })

    if (alterError) {
      // If exec_sql function doesn't exist, provide SQL for manual execution
      return NextResponse.json({
        error: 'Please run this SQL manually in Supabase SQL Editor',
        sql: `
-- Add website_domain column to newsletters table
ALTER TABLE newsletters
ADD COLUMN IF NOT EXISTS website_domain TEXT;

-- Update accounting newsletter with its website domain
UPDATE newsletters
SET website_domain = 'aiaccountingdaily.com'
WHERE slug = 'accounting';
        `,
        message: 'Copy and paste the SQL above into Supabase SQL Editor'
      }, { status: 200 })
    }

    // Update the accounting newsletter with its domain
    const { error: updateError } = await supabaseAdmin
      .from('publications')
      .update({ website_domain: 'aiaccountingdaily.com' })
      .eq('slug', 'accounting')

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: 'website_domain column added and accounting newsletter updated'
    })

  } catch (error) {
    console.error('Database migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      sql: `
-- Add website_domain column to newsletters table
ALTER TABLE newsletters
ADD COLUMN IF NOT EXISTS website_domain TEXT;

-- Update accounting newsletter with its website domain
UPDATE newsletters
SET website_domain = 'aiaccountingdaily.com'
WHERE slug = 'accounting';
      `,
      message: 'Please run the SQL above manually in Supabase SQL Editor'
    }, { status: 500 })
  }
  }
)
