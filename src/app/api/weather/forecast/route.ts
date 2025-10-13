import { NextRequest, NextResponse } from 'next/server'
import { getLatestWeatherForecast, getWeatherForecastByDate } from '@/lib/weather-manager'

export async function GET(request: NextRequest) {
  try {
    // WEATHER CACHING WORKFLOW:
    // 1. Campaign page calls this endpoint with newsletter date (e.g., ?date=2025-09-24)
    // 2. We look for cached weather forecast with matching forecast_date
    // 3. Return cached image URL and weather data (no on-demand generation)
    // 4. If no exact match, fallback to latest available forecast

    const searchParams = new URL(request.url).searchParams
    const campaignDate = searchParams.get('date')

    console.log('Fetching cached weather forecast for campaign date:', campaignDate || 'latest')

    let forecast = null

    if (campaignDate) {
      // Try to find forecast that matches the campaign date
      // Weather forecasts are generated for the day after creation, so:
      // - If campaign date is 2025-09-24, look for forecast_date 2025-09-24
      // - The forecast contains weather for the 3 days starting from that date
      forecast = await getWeatherForecastByDate(campaignDate)

      if (!forecast) {
        // Try to find the closest forecast if exact match not found
        console.log('No exact forecast match for', campaignDate, '- trying latest available')
        forecast = await getLatestWeatherForecast()
      }
    } else {
      // No specific date requested, get the latest
      forecast = await getLatestWeatherForecast()
    }

    if (!forecast) {
      return NextResponse.json({
        success: false,
        error: 'No weather forecast available',
        message: 'No cached weather data found. Weather forecasts are automatically generated daily at 8:00 PM Central Time. The next generation will occur tonight.',
        scheduleInfo: {
          cronSchedule: '0 20 * * *',
          timezone: 'America/Chicago',
          description: 'Daily at 8:00 PM Central'
        }
      }, { status: 404 })
    }

    // Format response similar to the debug endpoint for compatibility
    return NextResponse.json({
      success: true,
      weatherData: forecast.weather_data,
      html: forecast.html_content,
      imageUrl: forecast.image_url,
      forecastDate: forecast.forecast_date,
      generatedAt: forecast.generated_at,
      cached: true,
      message: `Showing cached weather forecast for ${forecast.forecast_date}${
        campaignDate && forecast.forecast_date !== campaignDate
          ? ` (requested: ${campaignDate})`
          : ''
      }`
    })

  } catch (error) {
    console.error('Error fetching weather forecast:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch weather forecast',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}