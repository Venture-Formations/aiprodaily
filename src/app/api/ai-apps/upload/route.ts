import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AIAppCategory, ToolType } from '@/types/database'

/**
 * POST /api/ai-apps/upload - Upload CSV file with AI applications
 *
 * CSV Format:
 * Tool Name, Category, Tool Type, Link, Description, Tagline, Affiliate
 *
 * Column Mappings:
 * - Tool Name → app_name
 * - Category → category (must match: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking)
 * - Tool Type → tool_type (must be: Client or Firm)
 * - Link → app_url (also accepts: Home Page, URL)
 * - Description → description
 * - Tagline → tagline
 * - Affiliate → is_affiliate (optional: yes/true/1 = affiliate, anything else = non-affiliate)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or has no data rows' },
        { status: 400 }
      )
    }

    // Get the accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    // Parse CSV
    const headers = parseCSVLine(lines[0])
    const apps: any[] = []
    const errors: string[] = []

    // Validate categories
    const validCategories: AIAppCategory[] = [
      'Payroll', 'HR', 'Accounting System', 'Finance',
      'Productivity', 'Client Management', 'Banking'
    ]
    const validToolTypes: ToolType[] = ['Client', 'Firm']

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = parseCSVLine(line)
        const row: any = {}

        // Map headers to values
        headers.forEach((header, index) => {
          row[header] = values[index] || null
        })

        // Map CSV columns to database fields
        const affiliateValue = row['Affiliate']?.trim()?.toLowerCase() || ''
        const isAffiliate = ['yes', 'true', '1', 'y'].includes(affiliateValue)

        const app: any = {
          newsletter_id: newsletter.id,
          app_name: row['Tool Name']?.trim() || row['tool name']?.trim() || row['App Name']?.trim() || null,
          category: row['Category']?.trim() || null,
          tool_type: row['Tool Type']?.trim() || row['tool type']?.trim() || 'Client',
          app_url: row['Link']?.trim() || row['link']?.trim() || row['Home Page']?.trim() || row['home page']?.trim() || row['URL']?.trim() || null,
          description: row['Description']?.trim() || null,
          tagline: row['Tagline']?.trim() || null,
          is_active: true,
          is_featured: false,
          is_paid_placement: false,
          is_affiliate: isAffiliate,
          category_priority: 0,
          times_used: 0
        }

        // Validate required fields
        if (!app.app_name) {
          errors.push(`Row ${i + 1}: Missing app name`)
          continue
        }

        if (!app.app_url) {
          errors.push(`Row ${i + 1}: Missing app URL (Link column)`)
          continue
        }

        if (!app.description) {
          errors.push(`Row ${i + 1}: Missing description`)
          continue
        }

        // Validate category
        if (app.category && !validCategories.includes(app.category)) {
          errors.push(`Row ${i + 1}: Invalid category "${app.category}". Must be one of: ${validCategories.join(', ')}`)
          continue
        }

        // Validate tool type
        if (app.tool_type && !validToolTypes.includes(app.tool_type)) {
          errors.push(`Row ${i + 1}: Invalid tool type "${app.tool_type}". Must be "Client" or "Firm"`)
          continue
        }

        apps.push(app)

      } catch (error: any) {
        errors.push(`Row ${i + 1}: ${error.message}`)
      }
    }

    // Insert apps into database
    let imported = 0
    if (apps.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('ai_applications')
        .insert(apps)
        .select()

      if (error) {
        console.error('Database insert error:', error)
        return NextResponse.json(
          { error: 'Failed to insert apps into database', details: error.message },
          { status: 500 }
        )
      }

      imported = data?.length || 0
    }

    return NextResponse.json({
      success: true,
      imported,
      total: lines.length - 1,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process CSV file', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current.trim())

  return result
}
