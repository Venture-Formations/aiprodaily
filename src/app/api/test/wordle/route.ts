import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function generateWordleSection(campaignDate?: string): Promise<string> {
  try {
    console.log('Testing Wordle section generation...')

    // Get yesterday's date from campaign date (since this is for "Yesterday's Wordle")
    let yesterday: Date
    if (campaignDate) {
      const newsletterDate = new Date(campaignDate + 'T00:00:00')
      yesterday = new Date(newsletterDate)
      yesterday.setDate(yesterday.getDate() - 1)
    } else {
      // Fallback to current date minus 1 day if no campaign date provided
      yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
    }
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    console.log('Looking for Wordle data for date:', yesterdayDate)

    // Fetch Wordle data for yesterday
    const { data: wordleData, error } = await supabaseAdmin
      .from('wordle')
      .select('*')
      .eq('date', yesterdayDate)
      .single()

    if (error || !wordleData) {
      console.log('No Wordle data found for yesterday:', yesterdayDate, 'excluding section')
      return '' // Don't include section if no data
    }

    console.log('Found Wordle data:', wordleData.word)

    // Generate the HTML using the template structure
    const wordleCard = `<table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 12px; background-color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.15); font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 26px;'>
      <tr><td style='background-color: #F8F9FA; text-align: center; padding: 8px; font-weight: bold; font-size: 24px; color: #3C4043; text-transform: uppercase;'>${wordleData.word}</td></tr>
      <tr><td style='padding: 16px;'>
        <div style='margin-bottom: 12px;'><strong>Definition:</strong> ${wordleData.definition}</div>
        <div><strong>Interesting Fact:</strong> ${wordleData.interesting_fact}</div>
      </td></tr>
    </table>`

    const wordleColumn = `<td class='column' style='padding:8px; vertical-align: top;'>${wordleCard}</td>`

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Yesterday's Wordle</h2>
    </td>
  </tr>
  <tr class="row">${wordleColumn}</tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Wordle section:', error)
    return `<div style="color: red; padding: 20px;">Error generating Wordle section: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const campaignDate = searchParams.get('campaign_date')

    console.log('🧩 Testing Wordle section, format:', format, 'campaign_date:', campaignDate)

    // Get yesterday's date from campaign date (since this is for "Yesterday's Wordle")
    let yesterday: Date
    if (campaignDate) {
      const newsletterDate = new Date(campaignDate + 'T00:00:00')
      yesterday = new Date(newsletterDate)
      yesterday.setDate(yesterday.getDate() - 1)
    } else {
      // Fallback to current date minus 1 day if no campaign date provided
      yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
    }
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    console.log('Looking for Wordle data for date:', yesterdayDate)

    // Fetch Wordle data for yesterday
    const { data: wordleData, error } = await supabaseAdmin
      .from('wordle')
      .select('*')
      .eq('date', yesterdayDate)
      .single()

    let finalWordleData = null
    if (error || !wordleData) {
      console.log('No Wordle data found for yesterday:', yesterdayDate, 'returning null')
      finalWordleData = null
    } else {
      finalWordleData = wordleData
      console.log('Found Wordle data:', wordleData.word)
    }

    // Return HTML format for email preview
    if (format === 'html') {
      const html = await generateWordleSection(campaignDate || undefined)
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }

    // Return JSON format for campaign page
    return NextResponse.json({
      success: true,
      wordle: finalWordleData,
      isTestData: !wordleData
    })

  } catch (error) {
    console.error('Wordle test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}