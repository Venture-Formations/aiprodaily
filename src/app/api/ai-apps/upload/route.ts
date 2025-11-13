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
 * - Tool Name → app_name (used to match existing apps - case insensitive)
 * - Category → category (must match: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking)
 * - Tool Type → tool_type (must be: Client or Firm)
 * - Link → app_url (also accepts: Home Page, URL)
 * - Description → description
 * - Tagline → tagline
 * - Affiliate → is_affiliate (optional: yes/true/1 = affiliate, anything else = non-affiliate)
 *
 * Behavior:
 * - If an app with the same name exists (case-insensitive match), it will be UPDATED with new data
 * - If an app doesn't exist, it will be INSERTED as a new record
 * - Returns counts for both inserted and updated apps
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
      .from('publications')
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
          publication_id: newsletter.id,
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

    // Process apps: update existing or insert new
    let inserted = 0
    let updated = 0

    if (apps.length > 0) {
      // Get all existing apps for this newsletter to check for duplicates
      const { data: existingApps } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, app_url')
        .eq('publication_id', newsletter.id)

      const existingAppMap = new Map(
        existingApps?.map(app => [app.app_name.toLowerCase(), app]) || []
      )

      for (const app of apps) {
        const existingApp = existingAppMap.get(app.app_name.toLowerCase())

        if (existingApp) {
          // Update existing app
          const { error } = await supabaseAdmin
            .from('ai_applications')
            .update({
              category: app.category,
              tool_type: app.tool_type,
              app_url: app.app_url,
              description: app.description,
              tagline: app.tagline,
              is_affiliate: app.is_affiliate
            })
            .eq('id', existingApp.id)

          if (error) {
            console.error('Error updating app:', app.app_name, error)
            errors.push(`Failed to update "${app.app_name}": ${error.message}`)
          } else {
            updated++
          }
        } else {
          // Insert new app
          const { error } = await supabaseAdmin
            .from('ai_applications')
            .insert(app)

          if (error) {
            console.error('Error inserting app:', app.app_name, error)
            errors.push(`Failed to insert "${app.app_name}": ${error.message}`)
          } else {
            inserted++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
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
