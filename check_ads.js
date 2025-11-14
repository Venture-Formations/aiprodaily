const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAds() {
  const { data, error } = await supabase
    .from('advertisements')
    .select('id, title, body')
    .eq('status', 'active')
    .limit(3);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  data.forEach(ad => {
    console.log(`\n=== ${ad.title} ===`);
    console.log('Body preview (first 500 chars):');
    console.log(ad.body.substring(0, 500));
    console.log('\nContains <ul>:', ad.body.includes('<ul>'));
    console.log('Contains <ol>:', ad.body.includes('<ol>'));
    console.log('Contains <li>:', ad.body.includes('<li>'));
  });
}

checkAds();
