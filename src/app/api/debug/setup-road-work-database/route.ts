import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Setting up Road Work database infrastructure...')

    // 1. Create road_work_data table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS road_work_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        road_work_data JSONB NOT NULL,
        html_content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    const { error: tableError } = await supabaseAdmin.rpc('execute_sql', {
      sql_query: createTableSQL
    })

    if (tableError) {
      console.error('Failed to create road_work_data table:', tableError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create road_work_data table',
        details: tableError.message
      }, { status: 500 })
    }

    console.log('✅ road_work_data table created')

    // 2. Create indexes for performance
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_road_work_data_campaign_id ON road_work_data(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_road_work_data_generated_at ON road_work_data(generated_at);
      CREATE INDEX IF NOT EXISTS idx_road_work_data_is_active ON road_work_data(is_active);
    `

    const { error: indexError } = await supabaseAdmin.rpc('execute_sql', {
      sql_query: createIndexesSQL
    })

    if (indexError) {
      console.error('Failed to create indexes:', indexError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create indexes',
        details: indexError.message
      }, { status: 500 })
    }

    console.log('✅ Indexes created')

    // 3. Create updated_at trigger function and trigger
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_road_work_data_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_road_work_data_updated_at ON road_work_data;
      CREATE TRIGGER trigger_road_work_data_updated_at
        BEFORE UPDATE ON road_work_data
        FOR EACH ROW
        EXECUTE FUNCTION update_road_work_data_updated_at();
    `

    const { error: triggerError } = await supabaseAdmin.rpc('execute_sql', {
      sql_query: createTriggerSQL
    })

    if (triggerError) {
      console.error('Failed to create trigger:', triggerError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create trigger',
        details: triggerError.message
      }, { status: 500 })
    }

    console.log('✅ Triggers created')

    // 4. Verify newsletter section exists
    const { data: section, error: sectionError } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('name', 'Road Work')
      .single()

    if (sectionError || !section) {
      console.log('Road Work section not found, creating...')

      const { error: insertError } = await supabaseAdmin
        .from('newsletter_sections')
        .insert({
          name: 'Road Work',
          display_order: 7,
          is_active: true
        })

      if (insertError) {
        console.error('Failed to create Road Work section:', insertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create Road Work section',
          details: insertError.message
        }, { status: 500 })
      }

      console.log('✅ Road Work section created')
    } else {
      console.log('✅ Road Work section already exists')
    }

    return NextResponse.json({
      success: true,
      message: 'Road Work database infrastructure setup completed successfully',
      components: {
        table: 'road_work_data table created',
        indexes: 'Performance indexes created',
        triggers: 'Auto-update triggers created',
        section: 'Newsletter section verified/created'
      }
    })

  } catch (error) {
    console.error('Road Work database setup failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to setup Road Work database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}