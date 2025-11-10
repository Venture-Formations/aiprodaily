import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Database setup endpoint for secondary articles feature
 * Run this endpoint to add the required columns and tables
 */
export async function GET(request: NextRequest) {
  try {
    const results = {
      rss_feeds_columns: { success: false, message: '' },
      secondary_articles_table: { success: false, message: '' },
      archived_secondary_articles_table: { success: false, message: '' }
    }

    // 1. Add columns to rss_feeds table
    try {
      const { error: feedsError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          ALTER TABLE rss_feeds
          ADD COLUMN IF NOT EXISTS use_for_primary_section BOOLEAN DEFAULT true,
          ADD COLUMN IF NOT EXISTS use_for_secondary_section BOOLEAN DEFAULT false;
        `
      })

      if (feedsError) {
        results.rss_feeds_columns = {
          success: false,
          message: feedsError.message
        }
      } else {
        results.rss_feeds_columns = {
          success: true,
          message: 'Columns added to rss_feeds table'
        }
      }
    } catch (error: any) {
      results.rss_feeds_columns = {
        success: false,
        message: error.message
      }
    }

    // 2. Create secondary_articles table
    try {
      const { error: secondaryError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS secondary_articles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id TEXT NOT NULL REFERENCES rss_posts(id) ON DELETE CASCADE,
            campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
            headline TEXT NOT NULL,
            content TEXT NOT NULL,
            rank INTEGER,
            is_active BOOLEAN DEFAULT false,
            skipped BOOLEAN DEFAULT false,
            fact_check_score NUMERIC(3, 2),
            fact_check_details TEXT,
            word_count INTEGER,
            review_position INTEGER,
            final_position INTEGER,
            breaking_news_score NUMERIC(3, 2),
            breaking_news_category TEXT,
            ai_summary TEXT,
            ai_title TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_secondary_articles_campaign ON secondary_articles(campaign_id);
          CREATE INDEX IF NOT EXISTS idx_secondary_articles_post ON secondary_articles(post_id);
          CREATE INDEX IF NOT EXISTS idx_secondary_articles_active ON secondary_articles(is_active) WHERE is_active = true;
        `
      })

      if (secondaryError) {
        results.secondary_articles_table = {
          success: false,
          message: secondaryError.message
        }
      } else {
        results.secondary_articles_table = {
          success: true,
          message: 'secondary_articles table created with indexes'
        }
      }
    } catch (error: any) {
      results.secondary_articles_table = {
        success: false,
        message: error.message
      }
    }

    // 3. Create archived_secondary_articles table
    try {
      const { error: archivedError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS archived_secondary_articles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            original_article_id TEXT NOT NULL,
            post_id TEXT,
            campaign_id TEXT NOT NULL,
            headline TEXT NOT NULL,
            content TEXT NOT NULL,
            rank INTEGER,
            is_active BOOLEAN,
            skipped BOOLEAN,
            fact_check_score NUMERIC(3, 2),
            fact_check_details TEXT,
            word_count INTEGER,
            review_position INTEGER,
            final_position INTEGER,
            archived_at TIMESTAMPTZ DEFAULT NOW(),
            archive_reason TEXT NOT NULL,
            campaign_date DATE,
            campaign_status TEXT,
            original_created_at TIMESTAMPTZ,
            original_updated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_archived_secondary_articles_campaign ON archived_secondary_articles(campaign_id);
        `
      })

      if (archivedError) {
        results.archived_secondary_articles_table = {
          success: false,
          message: archivedError.message
        }
      } else {
        results.archived_secondary_articles_table = {
          success: true,
          message: 'archived_secondary_articles table created with indexes'
        }
      }
    } catch (error: any) {
      results.archived_secondary_articles_table = {
        success: false,
        message: error.message
      }
    }

    const allSuccessful = Object.values(results).every(r => r.success)

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful
        ? 'All database changes applied successfully'
        : 'Some database changes failed - see details',
      details: results
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        note: 'You may need to run the SQL manually in Supabase SQL Editor. See database_migration_secondary_articles.sql file.'
      },
      { status: 500 }
    )
  }
}
