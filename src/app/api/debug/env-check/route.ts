import { NextRequest, NextResponse } from 'next/server'
import { generateDailyWeatherForecast } from '@/lib/weather-manager'

export async function GET(request: NextRequest) {
  try {
    // Check if we should save weather data
    const { searchParams } = new URL(request.url)
    const saveWeather = searchParams.get('weather') === 'save'

    if (saveWeather) {
      console.log('🌤️ Manual weather generation via env-check endpoint...')

      try {
        const forecast = await generateDailyWeatherForecast()
        console.log('✅ Weather forecast generated and saved:', forecast.id)

        return NextResponse.json({
          success: true,
          message: 'Weather forecast generated and saved to database',
          forecast: {
            id: forecast.id,
            forecast_date: forecast.forecast_date,
            generated_at: forecast.generated_at,
            has_image: !!forecast.image_url,
            weather_days: forecast.weather_data.length,
            image_url: forecast.image_url
          },
          weatherSaved: true
        })
      } catch (weatherError) {
        return NextResponse.json({
          error: 'Weather generation failed',
          message: weatherError instanceof Error ? weatherError.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // Original env check functionality
    const hasApiKey = !!process.env.HTML_CSS_TO_IMAGE_API_KEY
    const apiKeyLength = process.env.HTML_CSS_TO_IMAGE_API_KEY?.length || 0
    const hasUserId = !!process.env.HTML_CSS_TO_IMAGE_USER_ID
    const userIdLength = process.env.HTML_CSS_TO_IMAGE_USER_ID?.length || 0

    return NextResponse.json({
      hasApiKey,
      apiKeyLength,
      hasUserId,
      userIdLength,
      // Don't expose the actual values
      apiKeyPreview: process.env.HTML_CSS_TO_IMAGE_API_KEY ?
        `${process.env.HTML_CSS_TO_IMAGE_API_KEY.substring(0, 8)}...` :
        'Not set',
      userIdPreview: process.env.HTML_CSS_TO_IMAGE_USER_ID ?
        `${process.env.HTML_CSS_TO_IMAGE_USER_ID.substring(0, 8)}...` :
        'Not set',
      note: 'Add ?weather=save to generate and save weather forecast'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}