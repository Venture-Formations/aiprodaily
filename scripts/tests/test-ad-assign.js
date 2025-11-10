// Quick script to assign ad to campaign for testing
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://iylbqfsdhjmxfadwflss.supabase.co'
const supabaseKey = process.env.SECRET || '60NkupzhvNpuExfyl0aa9wzzVVnfWGWWPsr3gfvchTg='

const supabase = createClient(supabaseUrl, supabaseKey)

async function assignAd() {
  const campaignId = '0d573e0c-aaa4-49b7-9c69-98b0e02a2429'
  const adId = 'f6a40955-2a39-4776-bea0-a5b0add38b69'

  // Get campaign date
  const { data: campaign, error: campaignError } = await supabase
    .from('newsletter_campaigns')
    .select('date')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    console.error('Campaign not found:', campaignError)
    return
  }

  console.log('Campaign date:', campaign.date)

  // Check if already assigned
  const { data: existing } = await supabase
    .from('campaign_advertisements')
    .select('id')
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (existing) {
    // Update existing
    const { error: updateError } = await supabase
      .from('campaign_advertisements')
      .update({
        advertisement_id: adId,
        campaign_date: campaign.date,
        used_at: new Date().toISOString()
      })
      .eq('campaign_id', campaignId)

    if (updateError) {
      console.error('Update error:', updateError)
    } else {
      console.log('✓ Updated existing assignment')
    }
  } else {
    // Insert new
    const { error: insertError } = await supabase
      .from('campaign_advertisements')
      .insert({
        campaign_id: campaignId,
        advertisement_id: adId,
        campaign_date: campaign.date,
        used_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Insert error:', insertError)
    } else {
      console.log('✓ Inserted new assignment')
    }
  }

  console.log('Done! Ad assigned for testing.')
}

assignAd()
