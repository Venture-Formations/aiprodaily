// Check Database Table Types
// Run with: node check-database-types.js

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

async function checkDatabaseTypes() {
  console.log('\n🔍 Checking Database Table Types...\n');

  try {
    // Check what tables exist
    console.log('📊 Existing Tables:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (tablesError) {
      // Try direct SQL query instead
      const { data: tablesAlt, error: tablesAltError } = await supabase.rpc('exec_sql', {
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      });

      if (tablesAltError) {
        console.log('⚠️  Cannot query information_schema directly');
        console.log('   Checking specific tables instead...\n');

        // Check specific tables
        const tablesToCheck = ['newsletter_campaigns', 'duplicate_groups', 'articles', 'rss_posts'];
        for (const table of tablesToCheck) {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (error) {
            if (error.code === '42P01') {
              console.log(`❌ ${table} - Does not exist`);
            } else {
              console.log(`⚠️  ${table} - Error: ${error.message}`);
            }
          } else {
            console.log(`✅ ${table} - Exists (${count} rows)`);
          }
        }
        return;
      }

      console.log(tablesAlt);
    } else {
      if (tables && tables.length > 0) {
        tables.forEach(t => console.log(`   - ${t.table_name}`));
        console.log(`\n   Total: ${tables.length} tables\n`);
      } else {
        console.log('   No tables found (empty database)\n');
      }
    }

    // Check newsletter_campaigns structure
    console.log('🔍 Checking newsletter_campaigns.id type:');
    const { data: campaignsCol, error: campaignsError } = await supabase
      .from('newsletter_campaigns')
      .select('id')
      .limit(1);

    if (campaignsError) {
      if (campaignsError.code === '42P01') {
        console.log('   ✅ Table does not exist (this is good - fresh start!)');
      } else {
        console.log(`   ⚠️  Error: ${campaignsError.message}`);
      }
    } else {
      console.log('   ✅ Table exists');
      if (campaignsCol && campaignsCol.length > 0) {
        const idType = typeof campaignsCol[0].id;
        console.log(`   Type detected: ${idType}`);
        console.log(`   Sample value: ${campaignsCol[0].id}`);
      } else {
        console.log('   (Empty table)');
      }
    }

    // Check duplicate_groups
    console.log('\n🔍 Checking duplicate_groups.campaign_id type:');
    const { data: dupCol, error: dupError } = await supabase
      .from('duplicate_groups')
      .select('campaign_id')
      .limit(1);

    if (dupError) {
      if (dupError.code === '42P01') {
        console.log('   ✅ Table does not exist (this is good - fresh start!)');
      } else {
        console.log(`   ⚠️  Error: ${dupError.message}`);
      }
    } else {
      console.log('   ✅ Table exists');
      if (dupCol && dupCol.length > 0) {
        const idType = typeof dupCol[0].campaign_id;
        console.log(`   Type detected: ${idType}`);
        console.log(`   Sample value: ${dupCol[0].campaign_id}`);
      } else {
        console.log('   (Empty table)');
      }
    }

    console.log('\n✅ Diagnostic complete!\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }
}

checkDatabaseTypes().then(() => {
  process.exit(0);
});
