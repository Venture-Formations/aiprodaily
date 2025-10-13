import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { selectDiningDealsForCampaign, getDiningDealsForCampaign } from '@/lib/dining-selector'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get today's date for testing
    const today = new Date()
    const todayString = today.toISOString().split('T')[0] // YYYY-MM-DD format
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })

    console.log('Testing Dining Deals for:', todayString, dayOfWeek)

    // Check if we have any dining deals for today's day of week
    const { data: availableDeals, error: dealsError } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('business_name', { ascending: true })

    if (dealsError) {
      console.error('Error fetching available deals:', dealsError)
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    console.log(`Found ${availableDeals?.length || 0} deals for ${dayOfWeek}`)

    // Create a test campaign for testing purposes
    const testCampaignId = 'test-dining-deals-' + Date.now()

    // Select deals for the test campaign
    const selectionResult = await selectDiningDealsForCampaign(testCampaignId, today)

    // Generate HTML for testing
    let testHtml = ''
    if (selectionResult.deals && selectionResult.deals.length > 0) {
      // Format the date for display
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })

      // Generate deals HTML
      let dealsHtml = ''

      selectionResult.deals.forEach((deal: any, index: number) => {
        const isFeatured = deal.is_featured || index === 0
        const businessName = deal.business_name || ''
        const specialDescription = deal.special_description || ''
        const specialTime = deal.special_time || ''
        const googleProfile = deal.google_profile || '#'

        if (isFeatured) {
          // Featured deal format (first_special)
          dealsHtml += `
            <tr><td style='padding: 8px 16px; background:#E8F0FE; border:2px solid #1877F2; border-radius:6px;'>
              <div style='font-weight: bold;'>${businessName}</div>
              <div>${specialDescription}</div>
              <div style='font-size: 14px;'><a href='${googleProfile}' style='text-decoration: underline; color: inherit;'>${specialTime}</a></div>
            </td></tr>`
        } else {
          // Subsequent deals format
          dealsHtml += `
            <tr><td style='padding: 8px 16px 4px; font-weight: bold; border-top: 1px solid #eee;'>${businessName}</td></tr>
            <tr><td style='padding: 0 16px 2px;'>${specialDescription}</td></tr>
            <tr><td style='padding: 0 16px 8px; font-size: 14px;'><a href='${googleProfile}' style='text-decoration: underline; color: inherit;'>${specialTime}</a></td></tr>`
        }
      })

      // Wrap in card format
      const cardHtml = `
        <table width='100%' cellpadding='0' cellspacing='0' style='table-layout: fixed; border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.15);'>
          <tr><td style='background: #F8F9FA; padding: 8px; text-align: center; font-size: 16px; font-weight: normal; color: #3C4043; border-top-left-radius: 8px; border-top-right-radius: 8px;'>${formattedDate}</td></tr>
          ${dealsHtml}
        </table>`

      // Wrap in section format
      testHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
          <tr>
            <td style="padding: 5px;">
              <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Dining Deals</h2>
            </td>
          </tr>
          <tr class="row">
            <td class='column' style='padding:8px; vertical-align: top;'>
              ${cardHtml}
            </td>
          </tr>
        </table><br>`
    }

    // Clean up test campaign selections
    await supabaseAdmin
      .from('campaign_dining_selections')
      .delete()
      .eq('campaign_id', testCampaignId)

    const response = {
      success: true,
      deals: availableDeals || [], // For DiningDealsSection component
      test_date: todayString,
      day_of_week: dayOfWeek,
      available_deals_count: availableDeals?.length || 0,
      available_deals: availableDeals || [],
      selection_result: selectionResult,
      generated_html: testHtml,
      sample_deals: selectionResult.deals?.slice(0, 3).map((deal: any) => ({
        business_name: deal.business_name,
        special_description: deal.special_description,
        special_time: deal.special_time,
        is_featured: deal.is_featured
      })) || []
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dining deals test error:', error)
    return NextResponse.json({
      error: 'Failed to test dining deals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}