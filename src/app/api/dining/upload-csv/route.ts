import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read the CSV content
    const csvContent = await file.text()
    const lines = csvContent.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have at least a header and one data row' }, { status: 400 })
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

    // Expected columns mapping - google_cid will be converted to google_profile
    const columnMapping = {
      'Business Name': 'business_name',
      'business_name': 'business_name',
      'Business Address': 'business_address',
      'business_address': 'business_address',
      'Google CID': 'google_cid',
      'google_cid': 'google_cid',
      'Google Profile': 'google_profile',
      'google_profile': 'google_profile',
      'Day of Week': 'day_of_week',
      'day_of_week': 'day_of_week',
      'Special Description': 'special_description',
      'special_description': 'special_description',
      'Special Time': 'special_time',
      'special_time': 'special_time',
      'Is Featured': 'is_featured',
      'is_featured': 'is_featured',
      'Paid Placement': 'paid_placement',
      'paid_placement': 'paid_placement'
    }

    // Find column indices
    const columnIndices: { [key: string]: number } = {}
    for (const [csvHeader, dbField] of Object.entries(columnMapping)) {
      const index = headers.findIndex(h => h === csvHeader)
      if (index !== -1) {
        columnIndices[dbField] = index
      }
    }

    // Validate required columns
    const requiredFields = ['business_name', 'day_of_week', 'special_description']
    const missingFields = requiredFields.filter(field => !(field in columnIndices))
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingFields.map(f =>
          Object.keys(columnMapping).find(k => columnMapping[k as keyof typeof columnMapping] === f)
        ).join(', ')}`
      }, { status: 400 })
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        if (values.length === 0) continue // Skip empty lines

        // Skip example rows (check if any field contains "example" case-insensitive)
        const isExampleRow = values.some(value =>
          value && value.toLowerCase().includes('example')
        )
        if (isExampleRow) {
          results.skipped++
          continue
        }

        // Extract data from CSV row
        const rowData: any = {}
        let googleCid: string | null = null

        for (const [dbField, index] of Object.entries(columnIndices)) {
          const value = values[index]?.trim().replace(/"/g, '') || null

          if (value) {
            switch (dbField) {
              case 'day_of_week':
                if (validDays.includes(value)) {
                  rowData[dbField] = value
                } else {
                  throw new Error(`Invalid day of week: ${value}. Must be one of: ${validDays.join(', ')}`)
                }
                break
              case 'special_description':
                // Validate 65 character limit
                if (value.length > 65) {
                  throw new Error(`Special description exceeds 65 character limit (${value.length} characters): ${value.substring(0, 50)}...`)
                }
                rowData[dbField] = value
                break
              case 'google_cid':
                // Store CID to convert to URL later
                googleCid = value
                break
              case 'google_profile':
                // If google_profile is directly provided, use it
                rowData[dbField] = value
                break
              case 'is_featured':
              case 'paid_placement':
                // Parse boolean values (TRUE/FALSE, true/false, 1/0, yes/no)
                const boolValue = value.toLowerCase()
                rowData[dbField] = boolValue === 'true' || boolValue === '1' || boolValue === 'yes'
                break
              default:
                rowData[dbField] = value
            }
          }
        }

        // Convert Google CID to profile URL if provided
        if (googleCid && !rowData.google_profile) {
          rowData.google_profile = `https://maps.google.com/?cid=${googleCid}`
        }

        // Set defaults for boolean fields if not provided
        if (rowData.is_featured === undefined) rowData.is_featured = false
        if (rowData.paid_placement === undefined) rowData.paid_placement = false

        // Validate required fields
        if (!rowData.business_name || !rowData.day_of_week || !rowData.special_description) {
          results.errors.push(`Row ${i + 1}: Missing required fields`)
          continue
        }

        // Check if deal already exists (by business name, day, and special description)
        const { data: existing } = await supabaseAdmin
          .from('dining_deals')
          .select('id')
          .eq('business_name', rowData.business_name)
          .eq('day_of_week', rowData.day_of_week)
          .eq('special_description', rowData.special_description)
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        // Insert new deal
        const { error: insertError } = await supabaseAdmin
          .from('dining_deals')
          .insert([{
            ...rowData,
            is_featured: false, // Default to not featured, can be changed later
            is_active: true
          }])

        if (insertError) {
          results.errors.push(`Row ${i + 1}: ${insertError.message}`)
        } else {
          results.created++
        }

      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      message: 'CSV upload completed',
      results
    })

  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to parse CSV line with proper comma handling
function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}