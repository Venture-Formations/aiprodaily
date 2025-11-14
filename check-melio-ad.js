const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAd() {
  const { data, error } = await supabase
    .from('advertisements')
    .select('title, body')
    .eq('title', 'Melio: Pay vendors and get paid in one simple platform.')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('=== MELIO AD BODY ===\n');
  console.log(data.body);
}

checkAd();
