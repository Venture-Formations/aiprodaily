// Weather service for St. Cloud, MN weather forecasts
// Replaces Google Apps Script implementation using NWS API

export interface WeatherDay {
  day: string
  dateLabel: string
  icon: string
  precipitation: number
  high: number
  low: number
  condition: string
}

// St. Cloud, MN coordinates (approximately)
const LATITUDE = 45.5608
const LONGITUDE = -94.1622

/**
 * Fetch 3-day weather forecast starting from tomorrow
 */
export async function fetchWeatherData(): Promise<WeatherDay[]> {
  try {
    console.log('Fetching weather data for St. Cloud, MN')

    // Calculate target start date (start from tomorrow - weather is for next day)
    // Use Central Time for proper date calculation
    const now = new Date()
    const centralFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const centralDateStr = centralFormatter.format(now) // YYYY-MM-DD in Central Time
    const centralToday = new Date(centralDateStr + 'T00:00:00')
    const targetStartDate = new Date(centralToday.getTime() + (24 * 60 * 60 * 1000))

    // Get NWS grid info for St. Cloud
    const pointsResponse = await fetch(
      `https://api.weather.gov/points/${LATITUDE},${LONGITUDE}`,
      {
        headers: {
          'User-Agent': 'St. Cloud Scoop Newsletter (scoop@stcscoop.com)'
        }
      }
    )

    if (!pointsResponse.ok) {
      throw new Error(`Points API failed: ${pointsResponse.status}`)
    }

    const pointsData = await pointsResponse.json()
    const forecastUrl = pointsData.properties.forecast

    // Get forecast data
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        'User-Agent': 'St. Cloud Scoop Newsletter (scoop@stcscoop.com)'
      }
    })

    if (!forecastResponse.ok) {
      throw new Error(`Forecast API failed: ${forecastResponse.status}`)
    }

    const forecastData = await forecastResponse.json()
    const periods = forecastData.properties.periods

    // Process forecast periods into 3-day format
    const weatherDays: WeatherDay[] = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Group periods by date and extract high/low temps
    const dayData: { [key: string]: any } = {}

    for (const period of periods) {
      const periodDate = new Date(period.startTime)
      const dateKey = periodDate.toDateString()

      // Skip if this date is before our target start date
      if (periodDate < targetStartDate) continue

      if (!dayData[dateKey]) {
        dayData[dateKey] = {
          date: periodDate,
          periods: [],
          high: null,
          low: null
        }
      }

      dayData[dateKey].periods.push(period)

      // Track high and low temperatures
      // For high temperatures, prefer daytime but fall back to any period if needed
      if (period.isDaytime && (dayData[dateKey].high === null || period.temperature > dayData[dateKey].high)) {
        dayData[dateKey].high = period.temperature
      } else if (dayData[dateKey].high === null) {
        dayData[dateKey].high = period.temperature
      }

      // For low temperatures, prefer nighttime but fall back to any period if needed
      if (!period.isDaytime && (dayData[dateKey].low === null || period.temperature < dayData[dateKey].low)) {
        dayData[dateKey].low = period.temperature
      } else if (dayData[dateKey].low === null) {
        dayData[dateKey].low = period.temperature
      }
    }


    // Convert to WeatherDay format (limit to 3 days)
    const sortedDates = Object.keys(dayData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    for (let i = 0; i < sortedDates.length && weatherDays.length < 3; i++) {
      const dateKey = sortedDates[i]
      const data = dayData[dateKey]
      const date = data.date

      // Find daytime period for main conditions - skip days without daytime data
      const daytimePeriod = data.periods.find((p: any) => p.isDaytime)
      if (!daytimePeriod) {
        console.log(`Skipping ${dateKey} - no daytime period available (incomplete forecast)`)
        continue
      }

      // Map NWS icon to simple icon names
      let icon = 'sunny'
      if (daytimePeriod.icon) {
        const iconName = daytimePeriod.icon.toLowerCase()
        if (iconName.includes('rain') || iconName.includes('shower')) {
          icon = 'rainy'
        } else if (iconName.includes('cloud')) {
          icon = 'cloudy'
        } else if (iconName.includes('snow')) {
          icon = 'snowy'
        } else if (iconName.includes('thunder')) {
          icon = 'stormy'
        }
      }

      // Calculate precipitation probability
      let precipitation = 0
      for (const period of data.periods) {
        if (period.probabilityOfPrecipitation?.value) {
          precipitation = Math.max(precipitation, period.probabilityOfPrecipitation.value)
        }
      }

      // Use intelligent defaults for missing temperature data
      let high = data.high
      let low = data.low

      // If we're missing high temp but have daytime period, use that temperature
      if (high === null && daytimePeriod.isDaytime) {
        high = daytimePeriod.temperature
      }

      // If still missing data, use reasonable fallbacks
      if (high === null) high = low || 70 // Default to reasonable temp
      if (low === null) low = high || 50   // Default to reasonable temp

      // Get day label based on position: TODAY, TOMORROW, then actual day names
      let dayLabel: string
      if (weatherDays.length === 0) {
        dayLabel = "TODAY"
      } else if (weatherDays.length === 1) {
        dayLabel = "TOMORROW"
      } else {
        dayLabel = dayNames[date.getDay()].toUpperCase()
      }

      weatherDays.push({
        day: dayLabel,
        dateLabel: `${monthNames[date.getMonth()]} ${date.getDate()}`,
        icon,
        precipitation,
        high: high || 0,
        low: low || 0,
        condition: daytimePeriod.shortForecast || 'Unknown'
      })
    }


    console.log(`Processed ${weatherDays.length} weather days`)
    return weatherDays

  } catch (error) {
    console.error('Weather fetch error:', error)
    throw error
  }
}

/**
 * Generate HTML for weather display (matches original Google Apps Script format)
 */
export function generateWeatherHTML(weatherData: WeatherDay[]): string {
  const rows = weatherData.map(day => `
    <tr style="height: 60px;">
      <td style="text-align: center; padding: 8px; font-weight: bold; font-size: 14px; width: 80px;">
        ${day.day}<br>
        <span style="font-weight: normal; font-size: 12px; color: #666;">${day.dateLabel}</span>
      </td>
      <td style="text-align: center; padding: 8px; width: 60px;">
        <div style="font-size: 24px;">
          ${getWeatherEmoji(day.icon)}
        </div>
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
  `).join('')

  return `
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
        ${rows}
      </tbody>
    </table>
  `
}

/**
 * Generate newsletter-specific weather HTML
 */
export function generateNewsletterWeatherHTML(weatherData: WeatherDay[]): string {
  const weatherTable = generateWeatherHTML(weatherData)

  return `
    <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px; font-weight: bold;">
        🌤️ 3-Day Weather Forecast
      </h3>
      ${weatherTable}
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #666; text-align: center;">
        Forecast provided by the National Weather Service
      </p>
    </div>
  `
}

/**
 * Map weather conditions to emojis
 */
function getWeatherEmoji(icon: string): string {
  const emojiMap: { [key: string]: string } = {
    'sunny': '☀️',
    'cloudy': '☁️',
    'rainy': '🌧️',
    'snowy': '❄️',
    'stormy': '⛈️'
  }

  return emojiMap[icon] || '☀️'
}