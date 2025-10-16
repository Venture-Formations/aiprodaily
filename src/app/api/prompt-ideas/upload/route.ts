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
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Read CSV file
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 })
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'))

    // Expected columns: title, prompt_text, category, use_case, suggested_model, difficulty_level, is_active, is_featured
    const requiredColumns = ['title', 'prompt_text']
    const hasRequiredColumns = requiredColumns.every(col => header.includes(col))

    if (!hasRequiredColumns) {
      return NextResponse.json({
        error: `CSV must have columns: ${requiredColumns.join(', ')}. Found: ${header.join(', ')}`
      }, { status: 400 })
    }

    // Parse data rows
    const prompts = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      // Simple CSV parsing (handles quoted fields)
      const values: string[] = []
      let currentValue = ''
      let inQuotes = false

      for (let j = 0; j < line.length; j++) {
        const char = line[j]

        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim()) // Add last value

      if (values.length !== header.length) {
        console.warn(`Skipping row ${i}: column count mismatch`)
        continue
      }

      const row: Record<string, any> = {}
      header.forEach((col, idx) => {
        row[col] = values[idx].replace(/^"(.*)"$/, '$1') // Remove quotes
      })

      // Build prompt object
      const prompt: any = {
        title: row.title,
        prompt_text: row.prompt_text,
        category: row.category || 'Tax Preparation',
        use_case: row.use_case || null,
        suggested_model: row.suggested_model || 'ChatGPT',
        difficulty_level: row.difficulty_level || 'Intermediate',
        is_active: row.is_active === 'true' || row.is_active === '1' || row.is_active === 'TRUE',
        is_featured: row.is_featured === 'true' || row.is_featured === '1' || row.is_featured === 'TRUE'
      }

      if (prompt.title && prompt.prompt_text) {
        prompts.push(prompt)
      }
    }

    if (prompts.length === 0) {
      return NextResponse.json({ error: 'No valid prompts found in CSV' }, { status: 400 })
    }

    // Insert prompts into database
    const { data, error } = await supabaseAdmin
      .from('prompt_ideas')
      .insert(prompts)
      .select()

    if (error) {
      console.error('Database insert error:', error)
      return NextResponse.json({
        error: 'Failed to insert prompts',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      message: `Successfully imported ${data?.length || 0} prompt ideas`
    })

  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json({
      error: 'Failed to process CSV file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
