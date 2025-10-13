import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchWeatherData, generateWeatherHTML } from '@/lib/weather'
import { generateWeatherImage } from '@/lib/weather-image'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    console.log('🌤️ Force regenerating weather forecast...')

    // Get tomorrow's date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const forecastDate = tomorrow.toISOString().split('T')[0]

    console.log('Target forecast date:', forecastDate)

    // Delete existing forecast for this date
    const { error: deleteError } = await supabaseAdmin
      .from('weather_forecasts')
      .delete()
      .eq('forecast_date', forecastDate)

    if (deleteError) {
      console.log('No existing forecast to delete:', deleteError.message)
    } else {
      console.log('Deleted existing forecast for date:', forecastDate)
    }

    // Fetch fresh weather data
    console.log('Fetching fresh weather data...')
    const weatherData = await fetchWeatherData()
    console.log('Weather data fetched:', weatherData.length, 'days')

    // Generate HTML content
    const weatherHTML = generateWeatherHTML(weatherData)
    console.log('Weather HTML generated, length:', weatherHTML.length)

    // Generate image with detailed logging
    let imageUrl: string | null = null
    try {
      console.log('Starting weather image generation...')
      imageUrl = await generateWeatherImage(weatherData)

      if (imageUrl) {
        console.log('✅ Weather image generated successfully:', imageUrl)
      } else {
        console.log('⚠️ Weather image generation returned null')
      }
    } catch (error) {
      console.error('❌ Weather image generation failed:', error)
    }

    // Store new forecast
    const forecastData = {
      forecast_date: forecastDate,
      generated_at: new Date().toISOString(),
      weather_data: weatherData,
      html_content: weatherHTML,
      image_url: imageUrl,
      is_active: true
    }

    console.log('Saving forecast data to database...')
    const { data, error } = await supabaseAdmin
      .from('weather_forecasts')
      .insert(forecastData)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('✅ Weather forecast regenerated successfully:', data.id)

    return NextResponse.json({
      success: true,
      message: 'Weather forecast force regenerated',
      forecast: {
        id: data.id,
        forecast_date: data.forecast_date,
        generated_at: data.generated_at,
        image_url: data.image_url,
        has_image: !!data.image_url,
        weather_days: data.weather_data?.length || 0
      },
      weather_data: weatherData
    })

  } catch (error) {
    console.error('❌ Force weather regeneration failed:', error)

    return NextResponse.json({
      error: 'Force weather regeneration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}