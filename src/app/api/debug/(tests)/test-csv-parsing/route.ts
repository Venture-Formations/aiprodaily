import { NextRequest, NextResponse } from 'next/server'

// Copy of the CSV parsing function to test
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read the CSV content
    const csvContent = await file.text()

    // Parse CSV properly handling multi-line entries and quotes
    const parsedCSV = parseCSVContent(csvContent)

    console.log('Raw CSV content length:', csvContent.length)
    console.log('Total parsed rows:', parsedCSV.length)

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

    if (parsedCSV.length < 2) {
      return NextResponse.json({
        error: 'CSV must have at least a header and one data row',
        parsedRows: parsedCSV.length,
        firstRow: parsedCSV[0] || null
      }, { status: 400 })
    }

    // Parse CSV header
    const headers = parsedCSV[0].map(h => h.trim().replace(/"/g, ''))
    console.log('Headers found:', headers)

    // Find column indices
    const columnIndices: { [key: string]: number } = {}
    for (const [csvHeader, dbField] of Object.entries(columnMapping)) {
      const index = headers.findIndex(h => h === csvHeader)
      if (index !== -1) {
        columnIndices[dbField] = index
      }
    }

    console.log('Column indices:', columnIndices)

    // Validate required columns
    const requiredFields = ['title', 'link', 'listing_type']
    const missingFields = requiredFields.filter(field => !(field in columnIndices))

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missingFields.map(f =>
          Object.keys(columnMapping).find(k => columnMapping[k as keyof typeof columnMapping] === f)
        ).join(', ')}`,
        headers,
        columnIndices,
        missingFields
      }, { status: 400 })
    }

    // Analyze each data row without processing
    const rowAnalysis = []
    for (let i = 1; i < parsedCSV.length; i++) {
      const values = parsedCSV[i]
      const rowData: any = {}

      for (const [dbField, index] of Object.entries(columnIndices)) {
        const value = values[index]?.trim().replace(/"/g, '') || null
        rowData[dbField] = value
      }

      rowAnalysis.push({
        rowIndex: i,
        rawValues: values,
        extractedData: rowData,
        hasRequiredFields: rowData.title && rowData.link && rowData.listing_type,
        valuesLength: values.length,
        expectedColumns: Object.keys(columnIndices).length
      })
    }

    return NextResponse.json({
      success: true,
      totalRows: parsedCSV.length,
      headerRow: parsedCSV[0],
      dataRows: parsedCSV.length - 1,
      headers,
      columnIndices,
      rowAnalysis
    })

  } catch (error) {
    console.error('CSV test error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}