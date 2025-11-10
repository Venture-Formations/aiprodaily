import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin;

    // Check if columns already exist
    const { data: existingSettings, error: checkError } = await supabase
      .from('app_settings')
      .select('key, value')
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: 'Failed to check existing settings', details: checkError }, { status: 500 });
    }

    // Try to query for the new settings to see if they exist
    const { data: primaryCheck } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'primary_article_lookback_hours')
      .single();

    const { data: secondaryCheck } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'secondary_article_lookback_hours')
      .single();

    const results = {
      primary_exists: !!primaryCheck,
      secondary_exists: !!secondaryCheck,
      created: [] as string[]
    };

    // Create primary_article_lookback_hours if it doesn't exist
    if (!primaryCheck) {
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'primary_article_lookback_hours',
          value: '72',
          description: 'Hours to look back for articles in Primary RSS section'
        });

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create primary_article_lookback_hours', details: insertError }, { status: 500 });
      }
      results.created.push('primary_article_lookback_hours');
    }

    // Create secondary_article_lookback_hours if it doesn't exist
    if (!secondaryCheck) {
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'secondary_article_lookback_hours',
          value: '36',
          description: 'Hours to look back for articles in Secondary RSS section'
        });

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create secondary_article_lookback_hours', details: insertError }, { status: 500 });
      }
      results.created.push('secondary_article_lookback_hours');
    }

    return NextResponse.json({
      success: true,
      message: results.created.length > 0
        ? `Created ${results.created.length} settings: ${results.created.join(', ')}`
        : 'All settings already exist',
      results
    });

  } catch (error: any) {
    console.error('Error adding lookback columns:', error);
    return NextResponse.json({ error: 'Failed to add lookback columns', details: error.message }, { status: 500 });
  }
}
