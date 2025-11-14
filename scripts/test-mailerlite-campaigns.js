/**
 * Test script to check MailerLite campaign IDs
 * This queries MailerLite directly and compares with stored IDs
 * 
 * Usage: node scripts/test-mailerlite-campaigns.js
 */

const axios = require('axios')

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

async function checkMailerliteCampaigns() {
  try {
    if (!process.env.MAILERLITE_API_KEY) {
      console.error('Error: MAILERLITE_API_KEY environment variable not set')
      process.exit(1)
    }

    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log('[Debug] Querying MailerLite API for campaigns...\n')
    
    let mailerliteCampaigns = []
    let page = 1
    const perPage = 100
    
    try {
      while (true) {
        const response = await mailerliteClient.get('/campaigns', {
          params: {
            page,
            limit: perPage,
            sort: 'created_at',
            sort_dir: 'DESC'
          }
        })

        if (response.data?.data && Array.isArray(response.data.data)) {
          mailerliteCampaigns = mailerliteCampaigns.concat(response.data.data)
          
          console.log(`[Debug] Fetched page ${page}: ${response.data.data.length} campaigns`)
          
          // Check if there are more pages
          if (response.data.data.length < perPage) {
            break
          }
          page++
          
          // Safety limit
          if (page > 10) break
        } else {
          break
        }
      }
    } catch (error) {
      console.error('[Debug] Error fetching campaigns from MailerLite:', error.response?.data || error.message)
      throw error
    }

    console.log(`\n[Debug] Found ${mailerliteCampaigns.length} total campaigns in MailerLite\n`)

    // Show sample of campaign IDs
    console.log('=== Sample MailerLite Campaign IDs ===')
    mailerliteCampaigns.slice(0, 10).forEach((campaign, index) => {
      console.log(`${index + 1}. ID: ${campaign.id} (type: ${typeof campaign.id})`)
      console.log(`   Name: ${campaign.name}`)
      console.log(`   Status: ${campaign.status}`)
      console.log(`   Created: ${campaign.created_at}`)
      console.log(`   Full data keys: ${Object.keys(campaign).join(', ')}`)
      console.log('')
    })

    // Show ID format analysis
    const ids = mailerliteCampaigns.map(c => String(c.id))
    const idLengths = [...new Set(ids.map(id => id.length))]
    
    console.log('=== ID Format Analysis ===')
    console.log(`Total campaigns: ${mailerliteCampaigns.length}`)
    console.log(`Unique ID lengths: ${idLengths.join(', ')}`)
    console.log(`Sample IDs: ${ids.slice(0, 5).join(', ')}`)
    
    // Check for the IDs we have stored (you can add them here)
    const storedIds = [
      '169409034620765934',
      '169227818671015377',
      '169499636736722599',
      '169862021515314179',
      '170046990326957868'
    ]
    
    console.log('\n=== Checking Stored IDs ===')
    storedIds.forEach(storedId => {
      const exists = ids.includes(storedId)
      const existsAsNumber = ids.includes(String(Number(storedId)))
      console.log(`Stored ID: ${storedId}`)
      console.log(`  Exists as string: ${exists}`)
      console.log(`  Exists as number: ${existsAsNumber}`)
      if (exists) {
        const campaign = mailerliteCampaigns.find(c => String(c.id) === storedId)
        console.log(`  Campaign found: ${campaign?.name || 'N/A'}`)
      }
      console.log('')
    })

  } catch (error) {
    console.error('[Debug] Error:', error.message)
    if (error.response) {
      console.error('[Debug] Response status:', error.response.status)
      console.error('[Debug] Response data:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

checkMailerliteCampaigns()

