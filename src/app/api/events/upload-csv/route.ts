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

    // Expected columns mapping (supports both combined and separate date/time fields)
    const columnMapping = {
      'external_id': 'external_id',
      'External ID': 'external_id',
      'Title': 'title',
      'title': 'title',
      'Description': 'description',
      'description': 'description',
      'Start Date': 'start_date',
      'start_date': 'start_date',
      'Start Time': 'start_time',
      'start_time': 'start_time',
      'End Date': 'end_date',
      'end_date': 'end_date',
      'End Time': 'end_time',
      'end_time': 'end_time',
      'Venue': 'venue',
      'venue': 'venue',
      'Address': 'address',
      'address': 'address',
      'URL': 'url',
      'url': 'url',
      'Website': 'website',
      'website': 'website',
      'Image URL': 'image_url',
      'image_url': 'image_url',
      'Featured': 'featured',
      'featured': 'featured',
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
    const requiredFields = ['title', 'start_date']
    const missingFields = requiredFields.filter(field => !(field in columnIndices))
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingFields.map(f =>
          Object.keys(columnMapping).find(k => columnMapping[k as keyof typeof columnMapping] === f)
        ).join(', ')}`
      }, { status: 400 })
    }

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
        for (const [dbField, index] of Object.entries(columnIndices)) {
          const value = values[index]?.trim().replace(/"/g, '') || null

          if (dbField === 'featured' || dbField === 'paid_placement') {
            // Parse boolean values (TRUE/FALSE, true/false, 1/0, yes/no)
            if (value) {
              const boolValue = value.toLowerCase()
              rowData[dbField] = boolValue === 'true' || boolValue === '1' || boolValue === 'yes'
            }
          } else {
            rowData[dbField] = value
          }
        }

        // Combine separate date and time fields if provided
        if (rowData.start_date && rowData.start_time) {
          try {
            // Combine date and time: YYYY-MM-DD + HH:MM:SS
            const combinedStart = `${rowData.start_date}T${rowData.start_time}`
            const startObj = new Date(combinedStart)
            if (isNaN(startObj.getTime())) {
              throw new Error(`Invalid start date/time combination`)
            }
            rowData.start_date = startObj.toISOString()
          } catch (error) {
            throw new Error(`Invalid start date/time: ${rowData.start_date} ${rowData.start_time}`)
          }
        } else if (rowData.start_date) {
          // Handle date-only format (backward compatibility)
          try {
            const dateObj = new Date(rowData.start_date)
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Invalid date format`)
            }
            rowData.start_date = dateObj.toISOString()
          } catch (error) {
            throw new Error(`Invalid start date: ${rowData.start_date}`)
          }
        }

        // Same for end_date
        if (rowData.end_date && rowData.end_time) {
          try {
            const combinedEnd = `${rowData.end_date}T${rowData.end_time}`
            const endObj = new Date(combinedEnd)
            if (isNaN(endObj.getTime())) {
              throw new Error(`Invalid end date/time combination`)
            }
            rowData.end_date = endObj.toISOString()
          } catch (error) {
            throw new Error(`Invalid end date/time: ${rowData.end_date} ${rowData.end_time}`)
          }
        } else if (rowData.end_date) {
          // Handle date-only format (backward compatibility)
          try {
            const dateObj = new Date(rowData.end_date)
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Invalid date format`)
            }
            rowData.end_date = dateObj.toISOString()
          } catch (error) {
            throw new Error(`Invalid end date: ${rowData.end_date}`)
          }
        }

        // Remove temporary time fields (not in database schema)
        delete rowData.start_time
        delete rowData.end_time

        // Set defaults for boolean fields if not provided
        if (rowData.featured === undefined) rowData.featured = false
        if (rowData.paid_placement === undefined) rowData.paid_placement = false

        // Validate required fields
        if (!rowData.title || !rowData.start_date) {
          throw new Error('Missing required fields: Title and Start Date are required')
        }

        // Check if event already exists (by title, start_date, and venue)
        const { data: existing } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('title', rowData.title)
          .eq('start_date', rowData.start_date)
          .eq('venue', rowData.venue || '')
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        // Generate external_id for the event (using title + start_date as unique identifier)
        const externalId = `csv_${rowData.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${rowData.start_date}`

        // Insert new event
        const { error: insertError } = await supabaseAdmin
          .from('events')
          .insert([{
            external_id: externalId,
            title: rowData.title,
            description: rowData.description,
            start_date: rowData.start_date,
            end_date: rowData.end_date,
            venue: rowData.venue,
            address: rowData.address,
            url: rowData.url,
            image_url: rowData.image_url,
            featured: false, // Default to not featured
            active: true
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

    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current) // Add the last field
  return result
}