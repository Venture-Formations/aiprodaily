// Simple Supabase Connection Test
// Run with: node test-supabase-connection.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('\n📊 Test 1: Checking database connectivity...');

    // Test basic query
    const { data, error, count } = await supabase
      .from('newsletter_campaigns')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error details:', error.details);
      return false;
    }

    console.log('✅ Connection successful!');
    console.log(`   Found ${count} newsletter campaigns in database`);

    // Test table exists
    console.log('\n📊 Test 2: Checking newsletter_settings table...');
    const { data: settings, error: settingsError } = await supabase
      .from('newsletter_settings')
      .select('newsletter_id, newsletter_name')
      .limit(5);

    if (settingsError) {
      console.error('⚠️  Warning:', settingsError.message);
    } else {
      console.log('✅ Settings table accessible');
      if (settings && settings.length > 0) {
        console.log('   Newsletter(s) configured:', settings.map(s => s.newsletter_name).join(', '));
      } else {
        console.log('   No newsletters configured yet');
      }
    }

    // Test app_settings table
    console.log('\n📊 Test 3: Checking app_settings table...');
    const { data: appSettings, error: appSettingsError } = await supabase
      .from('app_settings')
      .select('key')
      .limit(5);

    if (appSettingsError) {
      console.error('⚠️  Warning:', appSettingsError.message);
    } else {
      console.log('✅ App settings table accessible');
      console.log(`   Found ${appSettings?.length || 0} settings`);
    }

    console.log('\n✅ All tests passed! Supabase is connected and working.\n');
    return true;

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
