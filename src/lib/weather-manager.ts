// Weather database operations and management

import { supabaseAdmin } from './supabase'
import { fetchWeatherData, generateWeatherHTML, generateNewsletterWeatherHTML } from './weather'
import { generateWeatherImage } from './weather-image'
import type { WeatherForecast } from '@/types/database'

/**
 * Generate and store daily weather forecast
 * Called by cron job at 8pm daily
 */
export async function generateDailyWeatherForecast(): Promise<WeatherForecast> {
  console.log('Starting daily weather forecast generation...')

  try {
    // Calculate forecast date (tomorrow in Central Time)
    const now = new Date()
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000))
    const forecastDate = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format

    console.log('Generating weather forecast for date:', forecastDate, '- will overwrite any existing forecast')

    // Fetch weather data from NWS
    const weatherData = await fetchWeatherData()
    console.log('Weather data fetched successfully')

    // Generate HTML content
    const weatherHTML = generateWeatherHTML(weatherData)
    console.log('Weather HTML generated')

    // Generate image (always attempt, with detailed logging)
    let imageUrl: string | null = null
    console.log('Starting weather image generation...')
    try {
      imageUrl = await generateWeatherImage(weatherData)
      if (imageUrl) {
        console.log('✅ Weather image generated successfully:', imageUrl)
      } else {
        console.log('⚠️ Weather image generation returned null (check API keys)')
      }
    } catch (error) {
      console.error('❌ Weather image generation failed:', error)
      console.log('Continuing with forecast without image...')
    }

    // Prepare forecast data
    const forecastData: Omit<WeatherForecast, 'id' | 'created_at' | 'updated_at'> = {
      forecast_date: forecastDate,
      generated_at: new Date().toISOString(),
      weather_data: weatherData,
      html_content: weatherHTML,
      image_url: imageUrl,
      is_active: true
    }

    // Store in database (upsert to handle duplicates, always overwrite)
    const supabase = supabaseAdmin
    const { data, error } = await supabase
      .from('weather_forecasts')
      .upsert(forecastData, {
        onConflict: 'forecast_date',
        ignoreDuplicates: false  // Always overwrite existing records
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('Weather forecast stored successfully:', data.id)
    return data

  } catch (error) {
    console.error('Daily weather forecast generation failed:', error)
    throw error
  }
}

/**
 * Get weather forecast for a specific campaign
 * Returns newsletter-formatted HTML
 */
export async function getWeatherForCampaign(campaignId: string): Promise<string | null> {
  try {
    // First get the campaign to find its date
    const supabase = supabaseAdmin
    const { data: campaign, error: campaignError } = await supabase
      .from('newsletter_campaigns')
      .select('date')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log('Campaign not found for weather lookup:', campaignId)
      return null
    }

    console.log('Looking for weather forecast for newsletter date:', campaign.date)

    // Get weather forecast that matches the newsletter date
    const { data, error } = await supabase
      .from('weather_forecasts')
      .select('*')
      .eq('forecast_date', campaign.date)
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.log('No weather forecast found for newsletter date:', campaign.date)
      return null
    }

    console.log('Found weather forecast for date:', data.forecast_date, 'with image:', !!data.image_url)

    // Use GitHub-hosted image if available, otherwise fall back to HTML
    if (data.image_url) {
      const imageBasedWeatherHTML = `
<!-- Section container -->
<table width='100%' cellpadding='0' cellspacing='0' border='0' style='width:100%; max-width:990px; margin:10px auto; mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:separate;'>
  <tr>
    <td style='padding:5px; vertical-align:top;'>
      <!-- White box -->
      <table width='100%' cellpadding='0' cellspacing='0' border='0' style='width:100%; border:1px solid #ddd; border-radius:8px; background:#fff; font-family:Arial, sans-serif; font-size:16px; line-height:26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
        <tr>
          <td style='padding:10px 5px; text-align:center;'>
            <!-- Weather image card -->
            <table width='100%' cellpadding='0' cellspacing='0' border='0' style='width:100%; max-width:650px; margin:0 auto; background:#fff; border-radius:10px;'>
              <tr>
                <td style='padding:0; text-align:center;'>
                  <img src='${data.image_url}' alt='3 Day Weather Forecast for St. Cloud, MN' style='display:block; width:100%; max-width:950px; height:auto; border-radius:15px;'/>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
      return imageBasedWeatherHTML
    } else {
      // Fallback to HTML text format
      const newsletterHTML = generateNewsletterWeatherHTML(data.weather_data)
      return newsletterHTML
    }

  } catch (error) {
    console.error('Error fetching weather for campaign:', error)
    return null
  }
}

/**
 * Get the latest weather forecast
 */
export async function getLatestWeatherForecast(): Promise<WeatherForecast | null> {
  try {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
      .from('weather_forecasts')
      .select('*')
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.log('No weather forecast found:', error.message)
      return null
    }

    return data

  } catch (error) {
    console.error('Error fetching latest weather forecast:', error)
    return null
  }
}

/**
 * Get weather forecast for a specific date
 */
export async function getWeatherForecastByDate(forecastDate: string): Promise<WeatherForecast | null> {
  try {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
      .from('weather_forecasts')
      .select('*')
      .eq('forecast_date', forecastDate)
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.log(`No weather forecast found for date ${forecastDate}:`, error.message)
      return null
    }

    return data

  } catch (error) {
    console.error(`Error fetching weather forecast for date ${forecastDate}:`, error)
    return null
  }
}

/**
 * Mark old forecasts as inactive (cleanup)
 */
export async function cleanupOldForecasts(): Promise<void> {
  try {
    // Mark forecasts older than 7 days as inactive
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 7)

    const supabase = supabaseAdmin
    const { error } = await supabase
      .from('weather_forecasts')
      .update({ is_active: false })
      .lt('forecast_date', cutoffDate.toISOString().split('T')[0])

    if (error) {
      throw new Error(`Cleanup error: ${error.message}`)
    }

    console.log('Old weather forecasts cleaned up')

    // Also cleanup old weather images from GitHub (keep 30 days)
    try {
      const { GitHubImageStorage } = await import('./github-storage')
      const githubStorage = new GitHubImageStorage()
      const deletedCount = await githubStorage.cleanupOldWeatherImages(30)
      console.log(`Cleaned up ${deletedCount} old weather images from GitHub`)
    } catch (githubError) {
      console.log('GitHub weather image cleanup skipped:', githubError instanceof Error ? githubError.message : 'Unknown error')
    }

  } catch (error) {
    console.error('Error cleaning up old forecasts:', error)
  }
}