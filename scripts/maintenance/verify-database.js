// Database Verification Script
// Run this to verify your Supabase database is set up correctly

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDatabase() {
  console.log('🔍 Verifying Database Setup...\n');

  try {
    // Check newsletters
    const { data: newsletters, error: nlError } = await supabase
      .from('newsletters')
      .select('*');

    if (nlError) throw nlError;
    console.log('✅ Newsletters table:', newsletters.length, 'records');
    if (newsletters.length > 0) {
      newsletters.forEach(nl => {
        console.log(`   - ${nl.name} (${nl.slug})`);
      });
    }

    // Check newsletter sections
    const { data: sections, error: secError } = await supabase
      .from('newsletter_sections')
      .select('*')
      .order('display_order');

    if (secError) throw secError;
    console.log('\n✅ Newsletter Sections:', sections.length, 'records');
    if (sections.length > 0) {
      sections.forEach(sec => {
        console.log(`   - ${sec.name} (order: ${sec.display_order})`);
      });
    }

    // Check AI applications
    const { data: apps, error: appsError } = await supabase
      .from('ai_applications')
      .select('*');

    if (appsError) throw appsError;
    console.log('\n✅ AI Applications:', apps.length, 'records');
    if (apps.length > 0) {
      apps.forEach(app => {
        console.log(`   - ${app.app_name} (${app.category})`);
      });
    }

    // Check prompt ideas
    const { data: prompts, error: promptsError } = await supabase
      .from('prompt_ideas')
      .select('*');

    if (promptsError) throw promptsError;
    console.log('\n✅ Prompt Ideas:', prompts.length, 'records');
    if (prompts.length > 0) {
      prompts.forEach(prompt => {
        console.log(`   - ${prompt.title} (${prompt.category})`);
      });
    }

    // Check all tables exist
    const expectedTables = [
      'newsletters',
      'newsletter_settings',
      'newsletter_campaigns',
      'rss_feeds',
      'rss_posts',
      'post_ratings',
      'articles',
      'manual_articles',
      'ai_applications',
      'campaign_ai_app_selections',
      'prompt_ideas',
      'campaign_prompt_selections',
      'advertisements',
      'campaign_advertisements',
      'events',
      'campaign_events',
      'newsletter_sections',
      'users',
      'system_logs',
      'user_activities',
      'app_settings',
      'email_metrics',
      'link_clicks',
      'archived_articles',
      'archived_rss_posts'
    ];

    console.log('\n📊 Core Tables Status:');
    for (const table of expectedTables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.log(`   ❌ ${table} - ERROR:`, error.message);
      } else {
        console.log(`   ✅ ${table}`);
      }
    }

    console.log('\n✨ Database verification complete!\n');
    console.log('🎯 Next Steps:');
    console.log('   1. Configure RSS feed for Accounting newsletter');
    console.log('   2. Create MailerLite groups (test and production)');
    console.log('   3. Add newsletter-specific settings to database');
    console.log('   4. Start building the newsletter layout code\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyDatabase();
