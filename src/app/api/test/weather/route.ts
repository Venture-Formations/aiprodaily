import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function generateWeatherSection(): Promise<string> {
  try {
    console.log('Testing Weather section generation...')

    // Get the most recent weather forecast
    const { data: weatherData, error } = await supabaseAdmin
      .from('weather_forecasts')
      .select('*')
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !weatherData) {
      console.log('No weather data found, creating test data...')

      // Create test weather data
      const testWeatherData = {
        weather_data: [
          {
            day: 'Today',
            dateLabel: 'Mon 23',
            icon: '☀️',
            high: 75,
            low: 52,
            precipitation: 0,
            condition: 'Sunny'
          },
          {
            day: 'Tomorrow',
            dateLabel: 'Tue 24',
            icon: '⛅',
            high: 68,
            low: 48,
            precipitation: 20,
            condition: 'Partly Cloudy'
          },
          {
            day: 'Wednesday',
            dateLabel: 'Wed 25',
            icon: '🌧️',
            high: 63,
            low: 45,
            precipitation: 80,
            condition: 'Rainy'
          }
        ],
        image_url: 'https://via.placeholder.com/600x400/87CEEB/ffffff?text=Test+Weather+Chart'
      }

      // Generate HTML using test data
      const weatherCards = testWeatherData.weather_data.map(day => `
        <td style="width: 33.33%; text-align: center; padding: 8px; border-right: 1px solid #eee;">
          <div style="font-size: 48px; margin-bottom: 8px;">${day.icon}</div>
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${day.day}</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${day.dateLabel}</div>
          <div style="font-size: 18px; font-weight: bold; color: #e74c3c; margin-bottom: 2px;">${day.high}°</div>
          <div style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px;">${day.low}°</div>
          <div style="font-size: 12px; color: #3498db;">${day.precipitation}% rain</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${day.condition}</div>
        </td>
      `).join('')

      return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Weather (TEST DATA)</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          ${weatherCards}
        </tr>
      </table>
      ${testWeatherData.image_url ? `
      <div style="text-align: center; margin-top: 16px;">
        <img src="${testWeatherData.image_url}" alt="Weather Chart" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      </div>
      ` : ''}
    </td>
  </tr>
</table>
<br>`
    }

    console.log('Found weather data:', weatherData.forecast_date)

    // Use real weather data
    const weatherCards = weatherData.weather_data.map((day: any) => `
      <td style="width: 33.33%; text-align: center; padding: 8px; border-right: 1px solid #eee;">
        <div style="font-size: 48px; margin-bottom: 8px;">${day.icon}</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${day.day}</div>
        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${day.dateLabel}</div>
        <div style="font-size: 18px; font-weight: bold; color: #e74c3c; margin-bottom: 2px;">${day.high}°</div>
        <div style="font-size: 14px; color: #7f8c8d; margin-bottom: 8px;">${day.low}°</div>
        <div style="font-size: 12px; color: #3498db;">${day.precipitation}% rain</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">${day.condition}</div>
      </td>
    `).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Weather</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          ${weatherCards}
        </tr>
      </table>
      ${weatherData.image_url ? `
      <div style="text-align: center; margin-top: 16px;">
        <img src="${weatherData.image_url}" alt="Weather Chart" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      </div>
      ` : ''}
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Weather section:', error)
    return `<div style="color: red; padding: 20px;">Error generating Weather section: ${error instanceof Error ? error.message : 'Unknown error'}</div>`
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🌤️ Testing Weather section generation...')

    const html = await generateWeatherSection()

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Weather test endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}