import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateNewsletterHeader, generateNewsletterFooter } from '@/lib/newsletter-templates'

function generateTestHeader(): string {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return generateNewsletterHeader(formattedDate)
}

function generateTestFooter(): string {
  return generateNewsletterFooter()
}

async function fetchSectionHtml(sectionName: string): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'
    const protocol = baseUrl.includes('localhost') ? 'http://' : 'https://'
    const cleanUrl = baseUrl.replace(/^https?:\/\//, '')

    const sectionUrls: { [key: string]: string } = {
      'wordle': '/api/test/wordle',
      'minnesota-getaways': '/api/test/minnesota-getaways',
      'local-events': '/api/test/local-events',
      'weather': '/api/test/weather',
      'dining-deals': '/api/test/dining-deals'
    }

    const url = `${protocol}${cleanUrl}${sectionUrls[sectionName]}`
    console.log(`Fetching section ${sectionName} from: ${url}`)

    const response = await fetch(url, {
      headers: {
        'Cookie': '', // This won't work for auth, but it's a test endpoint
      }
    })

    if (!response.ok) {
      return `<div style="color: red; padding: 20px;">Failed to load ${sectionName} section (${response.status})</div>`
    }

    return await response.text()
  } catch (error) {
    console.error(`Error fetching ${sectionName} section:`, error)
    return `<div style="color: red; padding: 20px;">Error loading ${sectionName} section: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🧪 Testing all newsletter sections together...')

    // Since we can't easily call the other endpoints from here due to auth,
    // we'll create a simplified version that includes test content for all sections

    const header = generateTestHeader()
    const footer = generateTestFooter()

    // Sample content for each section
    const sampleArticlesSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">The Local Scoop</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px;">
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 12px; color: #1877F2; font-size: 1.25em;">Sample Article 1</h3>
        <p style="margin: 0; color: #333; line-height: 1.6;">This is a sample article to show how the newsletter sections work together. Articles would normally be populated from your RSS feeds.</p>
      </div>
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 12px; color: #1877F2; font-size: 1.25em;">Sample Article 2</h3>
        <p style="margin: 0; color: #333; line-height: 1.6;">Another sample article showing the layout and formatting of newsletter content.</p>
      </div>
    </td>
  </tr>
</table>
<br>`

    const sampleLocalEventsSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Events (SAMPLE)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px; text-align: center; color: #666;">
      <p>Visit individual test endpoints to see full event layouts:</p>
      <p><strong>/api/test/local-events</strong></p>
    </td>
  </tr>
</table>
<br>`

    const sampleWeatherSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Weather (SAMPLE)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px; text-align: center; color: #666;">
      <p>Visit individual test endpoints to see full weather layouts:</p>
      <p><strong>/api/test/weather</strong></p>
    </td>
  </tr>
</table>
<br>`

    const sampleWordleSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Yesterday's Wordle (SAMPLE)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px; text-align: center; color: #666;">
      <p>Visit individual test endpoints to see full Wordle layouts:</p>
      <p><strong>/api/test/wordle</strong></p>
    </td>
  </tr>
</table>
<br>`

    const sampleGetawaysSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Minnesota Getaways (SAMPLE)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px; text-align: center; color: #666;">
      <p>Visit individual test endpoints to see full VRBO property layouts:</p>
      <p><strong>/api/test/minnesota-getaways</strong></p>
    </td>
  </tr>
</table>
<br>`

    const sampleDiningDealsSection = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Dining Deals (SAMPLE)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px; text-align: center; color: #666;">
      <p>Visit individual test endpoints to see full dining deals layouts:</p>
      <p><strong>/api/test/dining-deals</strong></p>
    </td>
  </tr>
</table>
<br>`

    const testEndpointsInfo = `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f0f8ff; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">📋 Individual Test Endpoints</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px;">
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px; color: #333;">🧩 Wordle Section</h3>
        <p style="margin: 0 0 8px; color: #666; font-family: monospace; background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px;">/api/test/wordle</p>
        <p style="margin: 0; color: #555; font-size: 14px;">Tests yesterday's Wordle word display with definition and interesting fact</p>
      </div>
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px; color: #333;">🏠 Minnesota Getaways Section</h3>
        <p style="margin: 0 0 8px; color: #666; font-family: monospace; background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px;">/api/test/minnesota-getaways</p>
        <p style="margin: 0; color: #555; font-size: 14px;">Tests VRBO property selection and 3-card layout display</p>
      </div>
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px; color: #333;">📅 Local Events Section</h3>
        <p style="margin: 0 0 8px; color: #666; font-family: monospace; background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px;">/api/test/local-events</p>
        <p style="margin: 0; color: #555; font-size: 14px;">Tests 3-day event display with featured and regular events</p>
      </div>
      <div style="background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px; color: #333;">🌤️ Weather Section</h3>
        <p style="margin: 0 0 8px; color: #666; font-family: monospace; background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px;">/api/test/weather</p>
        <p style="margin: 0; color: #555; font-size: 14px;">Tests 3-day weather forecast display with icons and charts</p>
      </div>
      <div style="background-color: #fff; border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 8px; color: #333;">🍽️ Dining Deals Section</h3>
        <p style="margin: 0 0 8px; color: #666; font-family: monospace; background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px;">/api/test/dining-deals</p>
        <p style="margin: 0; color: #555; font-size: 14px;">Tests day-of-week dining specials with featured deals prioritization</p>
      </div>
    </td>
  </tr>
</table>
<br>`

    // Combine all sections
    const html = header +
                 testEndpointsInfo +
                 sampleArticlesSection +
                 sampleLocalEventsSection +
                 sampleWeatherSection +
                 sampleWordleSection +
                 sampleGetawaysSection +
                 sampleDiningDealsSection +
                 footer

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('All sections test endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}