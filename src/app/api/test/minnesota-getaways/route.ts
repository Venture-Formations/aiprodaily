import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { VrboListing } from '@/types/database'
import { getSelectedPropertiesForCampaign, selectPropertiesForCampaign } from '@/lib/vrbo-selector'

async function generateMinnesotaGetawaysSection(): Promise<string> {
  try {
    console.log('Testing Minnesota Getaways section generation...')

    // Get active VRBO listings
    const { data: listings, error } = await supabaseAdmin
      .from('vrbo_listings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3)

    let selectedProperties: VrboListing[] = []

    if (error || !listings || listings.length === 0) {
      console.log('No VRBO listings found, creating test data...')

      // Create test data for demonstration
      selectedProperties = [
        {
          id: 'test-1',
          title: 'Cozy Lake Cabin',
          main_image_url: 'https://via.placeholder.com/575x325/4CAF50/white?text=Local+Property',
          adjusted_image_url: 'https://via.placeholder.com/575x325/4CAF50/white?text=Local+Property',
          city: 'St. Cloud, MN',
          bedrooms: 3,
          bathrooms: 2,
          sleeps: 6,
          link: 'https://vrbo.com/test-local',
          non_tracked_link: null,
          listing_type: 'Local',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'test-2',
          title: 'Scenic North Shore Retreat',
          main_image_url: 'https://via.placeholder.com/575x325/2196F3/white?text=Greater+Property+1',
          adjusted_image_url: 'https://via.placeholder.com/575x325/2196F3/white?text=Greater+Property+1',
          city: 'Duluth, MN',
          bedrooms: 4,
          bathrooms: 3,
          sleeps: 8,
          link: 'https://vrbo.com/test-greater-1',
          non_tracked_link: null,
          listing_type: 'Greater',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'test-3',
          title: 'Historic Downtown Loft',
          main_image_url: 'https://via.placeholder.com/575x325/FF9800/white?text=Greater+Property+2',
          adjusted_image_url: 'https://via.placeholder.com/575x325/FF9800/white?text=Greater+Property+2',
          city: 'Minneapolis, MN',
          bedrooms: 2,
          bathrooms: 1.5,
          sleeps: 4,
          link: 'https://vrbo.com/test-greater-2',
          non_tracked_link: null,
          listing_type: 'Greater',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    } else {
      selectedProperties = listings.slice(0, 3)
      console.log(`Found ${selectedProperties.length} VRBO listings for testing`)
    }

    // Generate HTML for each property using the provided template
    let propertyCards = ''

    selectedProperties.forEach((property, index) => {
      // Clean and validate data
      const title = property.title || ''
      const imageUrl = property.adjusted_image_url || property.main_image_url || `https://via.placeholder.com/575x325/ddd/999?text=No+Image`
      const city = property.city || ''
      const bedrooms = property.bedrooms || 0
      const bathrooms = property.bathrooms || 0
      const sleeps = property.sleeps || 0
      const link = property.link || '#'

      propertyCards += `
    <!-- CARD ${index + 1} -->
    <td class="column" width="33.33%" style="padding:8px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="table-layout:fixed;border:1px solid #ddd;border-radius:8px;background:#fff;height:100%;font-size:16px;line-height:26px;box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <!-- Image -->
        <tr>
          <!-- remove any gap above image -->
          <td style="padding:0;line-height:0;font-size:0;mso-line-height-rule:exactly;border-top-left-radius:8px;border-top-right-radius:8px;">
            <a href="${link}" style="display:block;text-decoration:none;">
              <img src="${imageUrl}"
                   alt="${title}, ${city}" border="0"
                   style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;border-top-left-radius:8px;border-top-right-radius:8px;">
            </a>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:6px 10px 6px;">
            <!-- 2-line clamp on desktop; mobile unlocks below -->
            <div class="vrbo-title" style="font-size:16px;line-height:20px;height:auto;overflow:hidden;font-weight:bold;margin:0 0 4px;">
              <a href="${link}" style="color:#0A66C2;text-decoration:none;">${title}</a>
            </div>
            <div style="font-size:13px;line-height:18px;color:#555;margin:0 0 8px;">${city}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;table-layout:fixed;">
              <tr>
                <td align="center" style="padding:4px 0;font-size:12px;color:#222;white-space:nowrap;"><strong>${bedrooms}</strong> BR</td>
                <td align="center" style="padding:4px 0;font-size:12px;color:#222;border-left:1px solid #eee;border-right:1px solid #eee;white-space:nowrap;"><strong>${bathrooms}</strong> BA</td>
                <td align="center" style="padding:4px 0;font-size:12px;color:#222;white-space:nowrap;">Sleeps <strong>${sleeps}</strong></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>`
    })

    const headerTitle = selectedProperties.length === 0 ? 'Minnesota Getaways (NO DATA)' : 'Minnesota Getaways (TEST)'

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">${headerTitle}</h2>
    </td>
  </tr>
  <tr>
<tr class="row">${propertyCards}
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

<!-- Mobile helpers: stack columns + allow long titles -->
<style>
@media only screen and (max-width:600px){
  .row .column{display:block !important;width:100% !important;max-width:100% !important;}
}
</style>
<!-- ===== /Minnesota Vrbo ===== -->
<br>`

  } catch (error) {
    console.error('Error generating Minnesota Getaways section:', error)
    return `<div style="color: red; padding: 20px;">Error generating Minnesota Getaways section: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    console.log('🏠 Testing Minnesota Getaways section generation...', 'campaign_id:', campaignId)

    let selectedProperties: VrboListing[] = []

    // If campaign_id provided, use campaign-specific properties (same as email preview)
    if (campaignId) {
      selectedProperties = await getSelectedPropertiesForCampaign(campaignId)

      if (selectedProperties.length === 0) {
        console.log('No properties selected yet for campaign, selecting now...')
        const selectionResult = await selectPropertiesForCampaign(campaignId)
        selectedProperties = selectionResult.selected
        console.log(selectionResult.message)
      }
    } else {
      // Fallback to generic active listings if no campaign_id
      const { data: listings, error } = await supabaseAdmin
        .from('vrbo_listings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error || !listings || listings.length === 0) {
        console.log('No VRBO listings found, creating test data...')

        // Create test data for demonstration
        selectedProperties = [
        {
          id: 'test-1',
          title: 'Cozy Lake Cabin',
          main_image_url: 'https://via.placeholder.com/575x325/4CAF50/white?text=Local+Property',
          adjusted_image_url: 'https://via.placeholder.com/575x325/4CAF50/white?text=Local+Property',
          city: 'St. Cloud, MN',
          bedrooms: 3,
          bathrooms: 2,
          sleeps: 6,
          link: 'https://vrbo.com/test-local',
          non_tracked_link: null,
          listing_type: 'Local',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'test-2',
          title: 'Scenic North Shore Retreat',
          main_image_url: 'https://via.placeholder.com/575x325/2196F3/white?text=Greater+Property+1',
          adjusted_image_url: 'https://via.placeholder.com/575x325/2196F3/white?text=Greater+Property+1',
          city: 'Duluth, MN',
          bedrooms: 4,
          bathrooms: 3,
          sleeps: 8,
          link: 'https://vrbo.com/test-greater-1',
          non_tracked_link: null,
          listing_type: 'Greater',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'test-3',
          title: 'Historic Downtown Loft',
          main_image_url: 'https://via.placeholder.com/575x325/FF9800/white?text=Greater+Property+2',
          adjusted_image_url: 'https://via.placeholder.com/575x325/FF9800/white?text=Greater+Property+2',
          city: 'Minneapolis, MN',
          bedrooms: 2,
          bathrooms: 1.5,
          sleeps: 4,
          link: 'https://vrbo.com/test-greater-2',
          non_tracked_link: null,
          listing_type: 'Greater',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
      } else {
        selectedProperties = listings.slice(0, 3)
        console.log(`Found ${selectedProperties.length} VRBO listings for campaign page`)
      }
    }

    return NextResponse.json({
      success: true,
      properties: selectedProperties,
      count: selectedProperties.length
    })

  } catch (error) {
    console.error('Minnesota Getaways test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}