import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherData, generateWeatherHTML } from '@/lib/weather'
import { generateWeatherImage } from '@/lib/weather-image'
import { generateDailyWeatherForecast } from '@/lib/weather-manager'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing weather system...')

    // Check if we should save to database
    const { searchParams } = new URL(request.url)
    const saveToDb = searchParams.get('save') === 'true'

    if (saveToDb) {
      console.log('🌤️ Testing with database save...')

      try {
        // Use the full weather manager pipeline
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
          weatherData: forecast.weather_data,
          htmlLength: forecast.html_content?.length || 0,
          saved: true
        })
      } catch (saveError) {
        console.error('❌ Database save failed:', saveError)
        return NextResponse.json({
          success: false,
          error: 'Database save failed',
          message: saveError instanceof Error ? saveError.message : 'Unknown error',
          saved: false
        }, { status: 500 })
      }
    }

    // Original test functionality (no database save)
    console.log('Testing weather generation without database save...')

    // Test weather data fetch
    const weatherData = await fetchWeatherData()
    console.log('Weather data fetched:', weatherData)

    // Test HTML generation
    const weatherHTML = generateWeatherHTML(weatherData)
    console.log('Weather HTML generated, length:', weatherHTML.length)

    // Test image generation (optional)
    let imageUrl = null
    let imageError = null
    try {
      imageUrl = await generateWeatherImage(weatherData)
      console.log('Weather image generated:', imageUrl)
    } catch (error) {
      imageError = error instanceof Error ? error.message : 'Unknown error'
      console.log('Image generation failed:', imageError)
    }

    return NextResponse.json({
      success: true,
      weatherData,
      htmlLength: weatherHTML.length,
      imageUrl,
      imageError,
      html: weatherHTML,
      saved: false,
      note: 'Add ?save=true to save to database'
    })
  } catch (error) {
    console.error('Weather test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}