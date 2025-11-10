// Simple Table Check
// Run with: node scripts/maintenance/simple-table-check.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const tables = [
  'newsletters',
  'newsletter_campaigns',
  'articles',
  'rss_posts',
  'duplicate_groups',
  'duplicate_posts',
  'newsletter_sections',
  'app_settings'
];

async function checkTables() {
  console.log('\n📊 Checking which tables exist:\n');

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.log(`❌ ${table.padEnd(25)} - Does NOT exist`);
      } else if (error.code === 'PGRST204') {
        console.log(`❌ ${table.padEnd(25)} - Not found in schema`);
      } else {
        console.log(`⚠️  ${table.padEnd(25)} - ${error.code}: ${error.message}`);
      }
    } else {
      console.log(`✅ ${table.padEnd(25)} - EXISTS (${count || 0} rows)`);
    }
  }

  console.log('\n✅ Check complete!\n');
}

checkTables();
