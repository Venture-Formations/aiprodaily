import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { days = 7 } = body // Default to populate 7 days

    console.log(`Populating weather database with ${days} days of sample data...`)

    // Generate weather forecasts for the next several days
    const weatherIcons = [
      'partly-cloudy-day', 'sunny', 'cloudy', 'rain', 'partly-cloudy-night',
      'clear-day', 'fog', 'snow', 'thunderstorm', 'wind'
    ]

    let insertedCount = 0
    let skippedCount = 0

    for (let i = 0; i < days; i++) {
      const forecastDate = new Date()
      forecastDate.setDate(forecastDate.getDate() + i)
      const dateStr = forecastDate.toISOString().split('T')[0]

      // Check if forecast already exists for this date
      const { data: existing } = await supabaseAdmin
        .from('weather_forecasts')
        .select('id')
        .eq('forecast_date', dateStr)
        .single()

      if (existing) {
        console.log(`Weather forecast for ${dateStr} already exists, skipping`)
        skippedCount++
        continue
      }

      // Generate sample weather data for 3 days starting from forecast date
      const weatherData = []
      for (let j = 0; j < 3; j++) {
        const dayDate = new Date(forecastDate)
        dayDate.setDate(forecastDate.getDate() + j)

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayName = dayNames[dayDate.getDay()]

        // Generate realistic weather data
        const baseTemp = 65 + Math.sin((Date.now() + j * 86400000) / 86400000) * 15 // Seasonal variation
        const tempVariation = Math.random() * 10 - 5
        const high = Math.round(baseTemp + tempVariation + Math.random() * 10)
        const low = Math.round(high - 10 - Math.random() * 10)

        weatherData.push({
          day: dayName,
          dateLabel: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          icon: weatherIcons[Math.floor(Math.random() * weatherIcons.length)],
          precipitation: Math.round(Math.random() * 40), // 0-40% chance
          high,
          low
        })
      }

      // Insert weather forecast
      const weatherForecast = {
        forecast_date: dateStr,
        weather_data: weatherData
      }

      const { error } = await supabaseAdmin
        .from('weather_forecasts')
        .insert([weatherForecast])

      if (error) {
        console.error(`Error inserting weather forecast for ${dateStr}:`, error)
        throw error
      }

      console.log(`Inserted weather forecast for ${dateStr}`)
      insertedCount++
    }

    // Get final count
    const { data: allForecasts, error: countError } = await supabaseAdmin
      .from('weather_forecasts')
      .select('forecast_date, weather_data')
      .order('forecast_date', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      message: `Weather population completed`,
      inserted: insertedCount,
      skipped: skippedCount,
      total_in_db: allForecasts?.length || 0,
      recent_entries: allForecasts?.map(f => ({
        date: f.forecast_date,
        days: f.weather_data?.length || 0,
        first_day: f.weather_data?.[0]
      })) || []
    })

  } catch (error) {
    console.error('Weather population error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}