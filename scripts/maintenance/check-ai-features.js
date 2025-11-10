// Check AI Features Tables
// Run with: node scripts/maintenance/check-ai-features.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const tables = [
  'ai_applications',
  'campaign_ai_app_selections',
  'prompt_ideas',
  'campaign_prompt_selections'
];

async function checkAIFeatures() {
  console.log('\n📊 Checking AI Features Tables:\n');

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST204') {
        console.log(`❌ ${table.padEnd(30)} - Does NOT exist`);
      } else {
        console.log(`⚠️  ${table.padEnd(30)} - Error: ${error.code}`);
      }
    } else {
      console.log(`✅ ${table.padEnd(30)} - EXISTS (${count || 0} rows)`);
    }
  }

  // Check if sample data exists
  console.log('\n📋 Sample Data Check:');

  const { data: apps, error: appsError } = await supabase
    .from('ai_applications')
    .select('app_name, newsletter_id')
    .limit(5);

  if (!appsError && apps && apps.length > 0) {
    console.log(`   ✅ ${apps.length} AI applications found`);
    apps.forEach(app => console.log(`      - ${app.app_name}`));
  } else {
    console.log(`   ℹ️  No AI applications yet (sample data not inserted)`);
  }

  const { data: prompts, error: promptsError } = await supabase
    .from('prompt_ideas')
    .select('title, newsletter_id')
    .limit(5);

  if (!promptsError && prompts && prompts.length > 0) {
    console.log(`\n   ✅ ${prompts.length} prompt ideas found`);
    prompts.forEach(prompt => console.log(`      - ${prompt.title}`));
  } else {
    console.log(`   ℹ️  No prompt ideas yet (sample data not inserted)`);
  }

  console.log('\n✅ Check complete!\n');
}

checkAIFeatures();
