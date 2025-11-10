// Check Specific Column Types via Direct Query
// Run with: node scripts/maintenance/check-column-types.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function checkColumnTypes() {
  console.log('\n🔍 Checking Column Data Types...\n');

  try {
    // Method 1: Try to insert and see what type is expected
    console.log('📊 Testing newsletter_campaigns.id type:');

    // Try UUID format
    const testUuid = '00000000-0000-0000-0000-000000000000';
    const { error: uuidError } = await supabase
      .from('newsletter_campaigns')
      .select('id')
      .eq('id', testUuid)
      .limit(1);

    if (!uuidError) {
      console.log('   ✅ Accepts UUID format (column is likely UUID type)');
    } else if (uuidError.code === 'PGRST116') {
      console.log('   ℹ️  No matching rows (but query worked)');
      console.log('   ✅ Column is UUID type');
    } else {
      console.log(`   ❌ Error with UUID: ${uuidError.message}`);
      console.log(`   Error code: ${uuidError.code}`);

      // Try TEXT format
      console.log('\n   Testing with TEXT format...');
      const { error: textError } = await supabase
        .from('newsletter_campaigns')
        .select('id')
        .eq('id', 'test-id')
        .limit(1);

      if (!textError || textError.code === 'PGRST116') {
        console.log('   ✅ Column is TEXT type');
      }
    }

    // Check duplicate_groups.campaign_id
    console.log('\n📊 Testing duplicate_groups.campaign_id type:');

    const { error: dupUuidError } = await supabase
      .from('duplicate_groups')
      .select('campaign_id')
      .eq('campaign_id', testUuid)
      .limit(1);

    if (!dupUuidError) {
      console.log('   ✅ Accepts UUID format (column is likely UUID type)');
    } else if (dupUuidError.code === 'PGRST116') {
      console.log('   ℹ️  No matching rows (but query worked)');
      console.log('   ✅ Column is UUID type');
    } else {
      console.log(`   ❌ Error with UUID: ${dupUuidError.message}`);
      console.log(`   Error code: ${dupUuidError.code}`);

      // Try TEXT format
      console.log('\n   Testing with TEXT format...');
      const { error: dupTextError } = await supabase
        .from('duplicate_groups')
        .select('campaign_id')
        .eq('campaign_id', 'test-id')
        .limit(1);

      if (!dupTextError || dupTextError.code === 'PGRST116') {
        console.log('   ✅ Column is TEXT type');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 RECOMMENDATION:');
    console.log('\nSince tables already exist, you have two options:');
    console.log('\n1. DROP AND RECREATE (Recommended):');
    console.log('   - Run: database_cleanup.sql in Supabase');
    console.log('   - Then run: database_complete_schema.sql');
    console.log('   - Then run: database_ai_features_schema.sql');
    console.log('\n2. ALTER EXISTING TABLES:');
    console.log('   - More complex, requires careful migration');
    console.log('   - Risk of data loss if foreign keys exist');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error('   This might mean the database connection failed.');
  }
}

checkColumnTypes().then(() => {
  process.exit(0);
});
