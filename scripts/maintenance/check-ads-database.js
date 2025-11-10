const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zvyzhmhsubazkvcsxbjs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eXpobWhzdWJhemt2Y3N4YmpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0ODM4MSwiZXhwIjoyMDczNjI0MzgxfQ._Ha892TCqFcuQhw2v1CWSCms6eKm8F1ePqE8jwSDwJk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdsDatabase() {
  console.log('🔍 Checking Advertisements Database\n');

  try {
    // Get all ads
    const { data: allAds, error: allError } = await supabase
      .from('advertisements')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) throw allError;

    console.log(`📊 Total Advertisements: ${allAds.length}\n`);

    // Group by status
    const byStatus = {
      pending: allAds.filter(ad => ad.status === 'pending'),
      approved: allAds.filter(ad => ad.status === 'approved'),
      rejected: allAds.filter(ad => ad.status === 'rejected'),
      active: allAds.filter(ad => ad.status === 'active'),
    };

    console.log('📈 Status Breakdown:');
    console.log(`  Pending:  ${byStatus.pending.length}`);
    console.log(`  Approved: ${byStatus.approved.length}`);
    console.log(`  Rejected: ${byStatus.rejected.length}`);
    console.log(`  Active:   ${byStatus.active.length}`);
    console.log();

    // Payment status
    const paid = allAds.filter(ad => ad.paid === true).length;
    const unpaid = allAds.filter(ad => ad.paid === false || ad.paid === null).length;

    console.log('💰 Payment Status:');
    console.log(`  Paid:   ${paid}`);
    console.log(`  Unpaid: ${unpaid}`);
    console.log();

    // Recent ads
    console.log('📝 Recent Advertisements (last 5):');
    allAds.slice(0, 5).forEach((ad, index) => {
      console.log(`\n  ${index + 1}. ${ad.business_name}`);
      console.log(`     ID:      ${ad.id}`);
      console.log(`     Status:  ${ad.status}`);
      console.log(`     Paid:    ${ad.paid ? 'Yes' : 'No'}`);
      console.log(`     Created: ${new Date(ad.created_at).toLocaleDateString()}`);
      if (ad.start_date && ad.end_date) {
        console.log(`     Dates:   ${ad.start_date} to ${ad.end_date}`);
      }
      if (ad.image_url) {
        console.log(`     Image:   ${ad.image_url.substring(0, 60)}...`);
      }
    });

    console.log('\n✅ Database check complete!');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    console.error(error);
  }
}

checkAdsDatabase();
