import { NextRequest, NextResponse } from 'next/server'
import { generateDailyWeatherForecast, cleanupOldForecasts } from '@/lib/weather-manager'

export async function GET(request: NextRequest) {
  console.log('🌤️ Starting manual weather forecast generation...')

  try {
    // Generate new weather forecast
    const forecast = await generateDailyWeatherForecast()
    console.log('✅ Weather forecast generated:', forecast.id)

    // Cleanup old forecasts
    await cleanupOldForecasts()
    console.log('✅ Old forecasts cleaned up')

    return NextResponse.json({
      success: true,
      message: 'Weather forecast generated and cached successfully',
      forecast: {
        id: forecast.id,
        forecast_date: forecast.forecast_date,
        generated_at: forecast.generated_at,
        has_image: !!forecast.image_url,
        weather_days: forecast.weather_data.length,
        image_url: forecast.image_url
      }
    })

  } catch (error) {
    console.error('❌ Manual weather generation failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate weather forecast'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}