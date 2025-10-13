import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { processVrboImage } from '@/lib/vrbo-image-processor'

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

    // Parse CSV properly handling multi-line entries and quotes
    const parsedCSV = parseCSVContent(csvContent)

    if (parsedCSV.length < 2) {
      return NextResponse.json({ error: 'CSV must have at least a header and one data row' }, { status: 400 })
    }

    // Parse CSV header
    const headers = parsedCSV[0].map(h => h.trim().replace(/"/g, ''))

    // Expected columns mapping
    const columnMapping = {
      'Title': 'title',
      'Main Image URL': 'main_image_url',
      'City': 'city',
      'Bedrooms': 'bedrooms',
      'Bathrooms': 'bathrooms',
      'Sleeps': 'sleeps',
      'Link': 'link',
      'Non-Tracked Link': 'non_tracked_link',
      'Local/Greater': 'listing_type',
      'Adjusted Main Image URL': 'adjusted_image_url'
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
    const requiredFields = ['title', 'link', 'listing_type']
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
      errors: [] as string[],
      imagesProcessed: 0,
      imagesFailed: 0,
      skippedReasons: [] as string[],
      processedRows: [] as any[]
    }

    // Process each data row
    for (let i = 1; i < parsedCSV.length; i++) {
      try {
        const values = parsedCSV[i]
        if (values.length === 0) continue // Skip empty lines

        // Skip example rows (check if any field contains "example" case-insensitive)
        const isExampleRow = values.some(value =>
          value && value.toLowerCase().includes('example')
        )
        if (isExampleRow) {
          results.skipped++
          results.skippedReasons.push(`Row ${i + 1}: Skipped example row`)
          continue
        }

        // Extract data from CSV row
        const rowData: any = {}
        for (const [dbField, index] of Object.entries(columnIndices)) {
          const value = values[index]?.trim().replace(/"/g, '') || null

          if (value) {
            switch (dbField) {
              case 'bedrooms':
              case 'sleeps':
                rowData[dbField] = parseInt(value) || null
                break
              case 'bathrooms':
                rowData[dbField] = parseFloat(value) || null
                break
              case 'listing_type':
                if (['Local', 'Greater'].includes(value)) {
                  rowData[dbField] = value
                } else {
                  throw new Error(`Invalid listing type: ${value}. Must be "Local" or "Greater"`)
                }
                break
              default:
                rowData[dbField] = value
            }
          }
        }

        // Validate required fields
        if (!rowData.title || !rowData.link || !rowData.listing_type) {
          results.errors.push(`Row ${i + 1}: Missing required fields - title: ${!!rowData.title}, link: ${!!rowData.link}, listing_type: ${!!rowData.listing_type}`)
          results.processedRows.push({ row: i + 1, title: rowData.title, status: 'missing_required_fields' })
          continue
        }

        // Check if listing already exists (by link)
        const { data: existing } = await supabaseAdmin
          .from('vrbo_listings')
          .select('id')
          .eq('link', rowData.link)
          .single()

        if (existing) {
          results.skipped++
          results.skippedReasons.push(`Row ${i + 1}: "${rowData.title}" already exists (ID: ${existing.id})`)
          results.processedRows.push({ row: i + 1, title: rowData.title, status: 'already_exists' })
          continue
        }

        // Process image if provided
        let adjusted_image_url = rowData.adjusted_image_url || null
        if (rowData.main_image_url && !adjusted_image_url) {
          console.log(`Processing VRBO image for CSV listing: ${rowData.title}`)
          try {
            const imageResult = await processVrboImage(rowData.main_image_url, rowData.title)
            if (imageResult.success && imageResult.adjusted_image_url) {
              adjusted_image_url = imageResult.adjusted_image_url
              console.log('Image processed successfully:', adjusted_image_url)
              results.imagesProcessed++
            } else {
              console.warn('Image processing failed:', imageResult.error)
              results.imagesFailed++
              // Continue with creation - image processing failure shouldn't block listing creation
            }
          } catch (imageError) {
            console.error('Image processing error:', imageError)
            results.imagesFailed++
            // Continue with creation - image processing failure shouldn't block listing creation
          }
        }

        // Insert new listing
        const { error: insertError } = await supabaseAdmin
          .from('vrbo_listings')
          .insert([{
            ...rowData,
            adjusted_image_url,
            is_active: true
          }])

        if (insertError) {
          results.errors.push(`Row ${i + 1}: ${insertError.message}`)
          results.processedRows.push({ row: i + 1, title: rowData.title, status: 'insert_error', error: insertError.message })
        } else {
          results.created++
          results.processedRows.push({ row: i + 1, title: rowData.title, status: 'created' })
        }

      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        results.processedRows.push({ row: i + 1, title: 'Unknown', status: 'processing_error', error: error instanceof Error ? error.message : 'Unknown error' })
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

// Helper function to parse CSV content with proper multi-line and quote handling
function parseCSVContent(content: string): string[][] {
  const result: string[][] = []
  const lines = content.split('\n')

  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        // Handle quote escaping (double quotes)
        if (inQuotes && j < line.length - 1 && line[j + 1] === '"') {
          currentField += '"'
          j++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentRow.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }

    // End of line
    if (inQuotes) {
      // Multi-line field, add newline and continue
      currentField += '\n'
    } else {
      // End of row
      currentRow.push(currentField.trim())

      // Only add non-empty rows with actual data
      if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
        result.push(currentRow)
      }

      currentRow = []
      currentField = ''
    }

    i++
  }

  // Handle any remaining row
  if (currentRow.length > 0 || currentField.trim().length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(field => field.trim().length > 0)) {
      result.push(currentRow)
    }
  }

  return result
}