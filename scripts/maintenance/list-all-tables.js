// List All Tables Directly via Supabase Admin
// Run with: node scripts/maintenance/list-all-tables.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listTables() {
  try {
    console.log('\n🔍 Querying Database via Supabase:\n');

    // List all tables via RPC
    console.log('Attempting to list tables...');

    // Try using a custom SQL function (if it exists) or query directly
    let tablesResult;
    try {
      const result = await supabase.rpc('exec_sql', {
        query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      });
      tablesResult = result;
    } catch (rpcError) {
      // RPC function doesn't exist, try listing known tables
      console.log('   ℹ️  Cannot query information_schema (RPC function not available)');
      console.log('   Checking known tables manually...\n');

      const knownTables = [
        'newsletters',
        'newsletter_settings',
        'newsletter_campaigns',
        'rss_feeds',
        'rss_posts',
        'post_ratings',
        'articles',
        'manual_articles',
        'duplicate_groups',
        'duplicate_posts',
        'users',
        'user_activities',
        'email_metrics',
        'app_settings'
      ];

      tablesResult = { data: [], error: null };
      console.log('📊 Table Existence Check:');

      for (const tableName of knownTables) {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST204') {
            console.log(`   ❌ ${tableName} - Does NOT exist`);
          } else {
            console.log(`   ⚠️  ${tableName} - Error: ${error.code} - ${error.message}`);
          }
        } else {
          console.log(`   ✅ ${tableName} - EXISTS (${count || 0} rows)`);
          tablesResult.data.push({ table_name: tableName });
        }
      }

      console.log(`\n   Total existing: ${tablesResult.data.length} tables`);
      return;
    }

    console.log('\n✅ Query complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

listTables();
