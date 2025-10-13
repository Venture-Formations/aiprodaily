import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('Manual weather database update...')

    const body = await request.json()
    const {
      forecast_date = '2025-09-24',
      weather_data,
      html_content,
      image_url = 'https://raw.githubusercontent.com/VFDavid/st-cloud-scoop/main/weather-images/weather-2025-09-23.png'
    } = body

    // Default weather data if not provided
    const defaultWeatherData = [
      {
        "day": "TODAY",
        "dateLabel": "Sep 24",
        "icon": "sunny",
        "precipitation": 0,
        "high": 74,
        "low": 54,
        "condition": "Widespread Fog then Mostly Sunny"
      },
      {
        "day": "TOMORROW",
        "dateLabel": "Sep 25",
        "icon": "sunny",
        "precipitation": 0,
        "high": 80,
        "low": 53,
        "condition": "Areas Of Fog then Sunny"
      },
      {
        "day": "FRIDAY",
        "dateLabel": "Sep 26",
        "icon": "sunny",
        "precipitation": 0,
        "high": 80,
        "low": 55,
        "condition": "Sunny"
      }
    ]

    const weatherData = weather_data || defaultWeatherData

    // Generate basic HTML if not provided
    const htmlContent = html_content || `
    <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; margin: 10px 0;">
      <thead>
        <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
          <th style="text-align: center; padding: 10px; font-size: 13px; font-weight: bold; width: 80px;">Day</th>
          <th style="text-align: center; padding: 10px; font-size: 13px; font-weight: bold; width: 60px;">Weather</th>
          <th style="text-align: center; padding: 10px; font-size: 13px; font-weight: bold; width: 60px;">Rain</th>
          <th style="text-align: center; padding: 10px; font-size: 13px; font-weight: bold; width: 80px;">Temp</th>
          <th style="text-align: left; padding: 10px; font-size: 13px; font-weight: bold;">Conditions</th>
        </tr>
      </thead>
      <tbody>
        ${weatherData.map((day: any) => `
        <tr style="height: 60px;">
          <td style="text-align: center; padding: 8px; font-weight: bold; font-size: 14px; width: 80px;">
            ${day.day}<br>
            <span style="font-weight: normal; font-size: 12px; color: #666;">${day.dateLabel}</span>
          </td>
          <td style="text-align: center; padding: 8px; width: 60px;">
            <div style="font-size: 24px;">☀️</div>
          </td>
          <td style="text-align: center; padding: 8px; font-size: 14px; width: 60px;">
            ${day.precipitation}%
          </td>
          <td style="text-align: center; padding: 8px; font-size: 14px; width: 80px;">
            <span style="font-weight: bold;">${day.high}°</span> / ${day.low}°
          </td>
          <td style="text-align: left; padding: 8px; font-size: 13px; color: #333;">
            ${day.condition}
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    `

    // Upsert to database
    const { data, error } = await supabaseAdmin
      .from('weather_forecasts')
      .upsert({
        forecast_date,
        generated_at: new Date().toISOString(),
        weather_data: weatherData,
        html_content: htmlContent,
        image_url,
        is_active: true
      }, {
        onConflict: 'forecast_date'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('Weather forecast updated successfully:', data.id)

    return NextResponse.json({
      success: true,
      message: 'Weather forecast updated in database',
      forecast: {
        id: data.id,
        forecast_date: data.forecast_date,
        generated_at: data.generated_at,
        image_url: data.image_url,
        weather_days: weatherData.length
      },
      weatherData,
      htmlLength: htmlContent.length
    })

  } catch (error) {
    console.error('Manual weather update failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Manual weather update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}