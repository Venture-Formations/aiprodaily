// Check Campaign Table Structure
// Run with: node check-campaign-structure.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkCampaignStructure() {
  console.log('\n🔍 Testing Campaign Creation:\n');

  try {
    // Get the accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabase
      .from('newsletters')
      .select('id, slug, name')
      .eq('slug', 'accounting')
      .single();

    if (newsletterError) {
      console.error('❌ Error fetching newsletter:', newsletterError.message);
      console.error('   Code:', newsletterError.code);
      return;
    }

    console.log('✅ Newsletter found:');
    console.log(`   ID: ${newsletter.id}`);
    console.log(`   Slug: ${newsletter.slug}`);
    console.log(`   Name: ${newsletter.name}`);

    // Try to create a test campaign WITH newsletter_id
    console.log('\n📝 Testing campaign creation WITH newsletter_id...');
    const testDate = '2025-10-20';

    const { data: campaign1, error: error1 } = await supabase
      .from('newsletter_campaigns')
      .insert({
        newsletter_id: newsletter.id,
        date: testDate,
        status: 'draft'
      })
      .select('*')
      .single();

    if (error1) {
      console.error('❌ Campaign creation WITH newsletter_id failed:');
      console.error('   Error:', error1.message);
      console.error('   Code:', error1.code);
      console.error('   Details:', error1.details);
    } else {
      console.log('✅ Campaign created WITH newsletter_id!');
      console.log(`   Campaign ID: ${campaign1.id}`);

      // Clean up test campaign
      await supabase.from('newsletter_campaigns').delete().eq('id', campaign1.id);
      console.log('   (Test campaign cleaned up)');
    }

    // Try to create a test campaign WITHOUT newsletter_id
    console.log('\n📝 Testing campaign creation WITHOUT newsletter_id...');

    const { data: campaign2, error: error2 } = await supabase
      .from('newsletter_campaigns')
      .insert({
        date: '2025-10-21',
        status: 'draft'
      })
      .select('*')
      .single();

    if (error2) {
      console.error('❌ Campaign creation WITHOUT newsletter_id failed:');
      console.error('   Error:', error2.message);
      console.error('   Code:', error2.code);

      if (error2.code === '23502') {
        console.log('\n💡 DIAGNOSIS: newsletter_id is a required (NOT NULL) column');
        console.log('   The API needs to pass newsletter_id when creating campaigns');
      }
    } else {
      console.log('✅ Campaign created WITHOUT newsletter_id!');
      console.log(`   Campaign ID: ${campaign2.id}`);
      console.log(`   newsletter_id: ${campaign2.newsletter_id || 'NULL'}`);

      // Clean up test campaign
      await supabase.from('newsletter_campaigns').delete().eq('id', campaign2.id);
      console.log('   (Test campaign cleaned up)');
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }

  console.log('\n✅ Test complete!\n');
}

checkCampaignStructure();
