// Weather image generation using HTML/CSS to Image API with GitHub hosting

import { GitHubImageStorage } from './github-storage'

interface ImageGenerationResponse {
  url: string
}

/**
 * Generate weather image from HTML using HTML/CSS to Image API
 * Downloads the generated image and uploads to GitHub for our own hosting
 * Uses the format specified in WeatherScript.txt
 */
export async function generateWeatherImage(weatherData: any[]): Promise<string | null> {
  const apiKey = process.env.HTML_CSS_TO_IMAGE_API_KEY
  const userId = process.env.HTML_CSS_TO_IMAGE_USER_ID

  if (!apiKey || !userId) {
    console.log('HTML_CSS_TO_IMAGE_API_KEY or HTML_CSS_TO_IMAGE_USER_ID not set, skipping image generation')
    console.log('API Key present:', !!apiKey, 'User ID present:', !!userId)
    return null
  }

  console.log('API key found, length:', apiKey.length)
  console.log('User ID found, length:', userId.length)

  try {
    // Generate weather cards HTML using WeatherScript.txt format
    const imageHtml = createWeatherWidgetHTML(weatherData)
    console.log('Generated weather widget HTML, length:', imageHtml.length)
    console.log('First 200 chars of HTML:', imageHtml.substring(0, 200))

    console.log('Generating weather image via HTML/CSS to Image API...')

    const response = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`
      },
      body: JSON.stringify({
        html: imageHtml,
        css: '',
        width: 650,
        height: 400,
        device_scale_factor: 2,
        format: 'png'
      })
    })

    console.log('Image API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Image API error response:', errorText)
      throw new Error(`Image API failed: ${response.status} - ${errorText}`)
    }

    const result: ImageGenerationResponse = await response.json()
    console.log('Weather image generated at external URL:', result.url)

    // Now download the image and upload to GitHub for our own hosting
    console.log('Downloading weather image and uploading to GitHub...')

    const githubStorage = new GitHubImageStorage()
    const forecastDate = new Date().toISOString().split('T')[0]
    const weatherTitle = `Weather forecast for ${forecastDate}`

    const githubImageUrl = await githubStorage.uploadWeatherImage(result.url, forecastDate)

    if (githubImageUrl) {
      console.log('Weather image successfully hosted on GitHub:', githubImageUrl)
      return githubImageUrl
    } else {
      console.log('GitHub upload failed, falling back to external URL:', result.url)
      return result.url
    }

  } catch (error) {
    console.error('Weather image generation failed:', error)
    return null
  }
}

/**
 * Create weather widget HTML in the format specified by WeatherScript.txt
 */
function createWeatherWidgetHTML(weatherData: any[]): string {
  const CONFIG = {
    HEADER_IMAGE_URL: 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/WeatherBanner2.png',
    BACKGROUND_IMAGE_URL: 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Reflective%20Roadway%20Under%20Blue%20Sky%202.png'
  }

  let cards = ''

  weatherData.forEach((day) => {
    const iconUrl = getWeatherIconUrl(mapConditionToIcon(day.condition || day.icon))

    cards += `
          <td class="weather-card" align="center" valign="top" style="width: 33.33%; padding: 10px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(#023D8E 0%, #1877F2 100%); box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.3);">
              <tr>
                <td align="center" style="padding: 0;">

                  <!-- Day Label -->
                  <div style="background: linear-gradient(90deg, #BABABA 0%, #FEFEFE 25%, #FEFEFE 75%, #BABABA 100%); color: #023D8E; font-size: 24px; font-weight: bold; margin-bottom: 5px; font-family: 'Montserrat', 'Arial Black', 'Trebuchet MS', Arial, sans-serif; text-transform: uppercase; padding: 8px 0;">
                    ${day.day}
                  </div>

                  <!-- Calendar Date -->
                  <div style="color: white; font-size: 16px; font-weight: bold; margin-bottom: 0; font-family: 'Montserrat', 'Arial Black', 'Trebuchet MS', Arial, sans-serif;">
                    ${day.dateLabel}
                  </div>

                  <!-- Weather Icon -->
                  <div style="margin-bottom: -5px;">
                    <img src="${iconUrl}" alt="Weather" style="width: 150px; height: 150px; display: block; margin: 0 auto;" />
                  </div>

                  <!-- Precipitation -->
                  <div style="color: white; font-size: 16px; font-weight: bold; margin-bottom: 0; font-family: 'Montserrat', 'Arial Black', 'Trebuchet MS', Arial, sans-serif;">
                    ${day.precipitation > 0 ? day.precipitation + '%' : '0%'}
                  </div>

                  <!-- High Temperature -->
                  <div style="color: white; font-size: 72px; font-weight: bold; margin-bottom: 0; font-family: 'Montserrat', 'Arial Black', 'Trebuchet MS', Arial, sans-serif; line-height: 1;">
                    ${day.high}
                  </div>

                  <!-- Low Temperature -->
                  <div style="color: white; font-size: 22px; font-weight: bold; font-family: 'Montserrat', 'Arial Black', 'Trebuchet MS', Arial, sans-serif;">
                    ${day.low}
                  </div>

                </td>
              </tr>
            </table>
          </td>`
  })

  return `
<!-- Weather Widget v2.0 - Generated at ${new Date().toISOString()} -->
<!--[if mso]>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td>
<![endif]-->

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; margin: 0 auto; background-image: url('${CONFIG.BACKGROUND_IMAGE_URL}'); background-size: cover; background-position: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-family: Arial, sans-serif; overflow: hidden;">
  <tr>
    <td align="center" style="padding: 0;">

      <!-- Header Image -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 0;">
            <img src="${CONFIG.HEADER_IMAGE_URL}" alt="Weather Forecast" style="width: 90%; max-width: 650px; height: auto; display: block;" />
          </td>
        </tr>
      </table>

      <!-- Weather Cards Container -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 10px 20px;">
        <tr>
          ${cards}
        </tr>
      </table>

    </td>
  </tr>
</table>

<style>
  @media only screen and (max-width: 600px) {
    .weather-card {
      display: block !important;
      width: 100% !important;
      margin-bottom: 15px !important;
      padding: 10px !important;
    }

    .weather-card table {
      width: 90% !important;
      margin: 0 auto !important;
    }

    .weather-card td {
      padding: 15px 10px !important;
    }
  }
</style>

<!--[if mso]>
    </td>
  </tr>
</table>
<![endif]-->`
}

/**
 * Map NWS conditions to icon codes
 */
function mapConditionToIcon(condition: string): string {
  const conditionLower = condition.toLowerCase()

  if (conditionLower.includes('sunny') || conditionLower.includes('clear')) return '01d'
  if (conditionLower.includes('partly cloudy') || conditionLower.includes('mostly sunny')) return '02d'
  if (conditionLower.includes('mostly cloudy')) return '03d'
  if (conditionLower.includes('cloudy') || conditionLower.includes('overcast')) return '04d'
  if (conditionLower.includes('freezing') || conditionLower.includes('sleet')) return 'sleet'
  if (conditionLower.includes('blizzard') || conditionLower.includes('heavy snow')) return 'blizzard'
  if (conditionLower.includes('snow')) return '13d'
  if (conditionLower.includes('hail')) return 'hail'
  if (conditionLower.includes('thunder')) return '11d'
  if (conditionLower.includes('rain')) {
    if (conditionLower.includes('light')) return '09d'
    return '10d'
  }
  if (conditionLower.includes('fog') || conditionLower.includes('mist')) return '50d'

  return '02d' // Default partly cloudy
}

/**
 * Get weather icon URL from GitHub repository
 */
function getWeatherIconUrl(iconCode: string): string {
  const iconMap: { [key: string]: string } = {
    '01d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Sun.png',
    '02d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Cloudy_day.png',
    '03d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Cloudy_day.png',
    '04d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Mostly_Cloudy.png',
    '09d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Drizzle.png',
    '10d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Heavy_Rain.png',
    '11d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Thunderstorms.png',
    '13d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Snow.png',
    '50d': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/main/Fog.png',
    'hail': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/refs/heads/main/Clip_hail_rain.png',
    'blizzard': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/refs/heads/main/Blizzard.png',
    'sleet': 'https://raw.githubusercontent.com/VFDavid/weatherwidget/refs/heads/main/Sleet.png'
  }

  return iconMap[iconCode] || iconMap['01d']
}