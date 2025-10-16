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

    // Parse CSV properly handling quoted fields with newlines and commas
    const parseCSV = (csvText: string): string[][] => {
      const rows: string[][] = []
      let currentRow: string[] = []
      let currentField = ''
      let insideQuotes = false

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i]
        const nextChar = csvText[i + 1]

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            // Escaped quote
            currentField += '"'
            i++ // Skip next quote
          } else {
            // Toggle quote state
            insideQuotes = !insideQuotes
          }
        } else if (char === ',' && !insideQuotes) {
          // End of field
          currentRow.push(currentField.trim())
          currentField = ''
        } else if (char === '\n' && !insideQuotes) {
          // End of row
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim())
            if (currentRow.some(f => f)) { // Only add non-empty rows
              rows.push(currentRow)
            }
            currentRow = []
            currentField = ''
          }
        } else if (char === '\r' && nextChar === '\n' && !insideQuotes) {
          // Windows line ending
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim())
            if (currentRow.some(f => f)) {
              rows.push(currentRow)
            }
            currentRow = []
            currentField = ''
          }
          i++ // Skip the \n
        } else {
          currentField += char
        }
      }

      // Add last field and row
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim())
        if (currentRow.some(f => f)) {
          rows.push(currentRow)
        }
      }

      return rows
    }

    const rows = parseCSV(text)

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 })
    }

    // Parse header
    const header = rows[0].map(h => h.trim())

    // Column mapping - accept various common column name variations
    const columnMappings: Record<string, string[]> = {
      title: ['title', 'Title', 'name', 'Name', 'Prompt Title', 'prompt_title', 'TITLE'],
      prompt_text: ['prompt_text', 'Prompt Text', 'Prompt', 'prompt', 'Prompt_Text', 'PROMPT', 'text', 'Text', 'Content', 'content'],
      category: ['category', 'Category', 'CATEGORY'],
      use_case: ['use_case', 'Use Case', 'UseCase', 'use case', 'USE_CASE'],
      suggested_model: ['suggested_model', 'Suggested Model', 'Model', 'model', 'SUGGESTED_MODEL'],
      difficulty_level: ['difficulty_level', 'Difficulty Level', 'Difficulty', 'difficulty', 'DIFFICULTY_LEVEL']
    }

    // Function to find matching column
    const findColumn = (fieldName: string): string | null => {
      const possibleNames = columnMappings[fieldName] || [fieldName]
      for (const possibleName of possibleNames) {
        if (header.includes(possibleName)) {
          return possibleName
        }
      }
      return null
    }

    // Map required fields
    const titleColumn = findColumn('title')
    const promptColumn = findColumn('prompt_text')

    if (!titleColumn || !promptColumn) {
      const missing = []
      if (!titleColumn) missing.push('title (or variations: Title, Name, Prompt Title)')
      if (!promptColumn) missing.push('prompt_text (or variations: Prompt, Prompt Text, Text)')

      return NextResponse.json({
        error: `CSV is missing required columns: ${missing.join(', ')}`,
        foundColumns: header.join(', '),
        suggestion: 'Please ensure your CSV has columns for title/name and prompt/text'
      }, { status: 400 })
    }

    // Map optional fields
    const categoryColumn = findColumn('category')
    const useCaseColumn = findColumn('use_case')
    const modelColumn = findColumn('suggested_model')
    const difficultyColumn = findColumn('difficulty_level')

    // Parse data rows
    const prompts = []
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i]

      if (values.length !== header.length) {
        console.warn(`Skipping row ${i}: column count mismatch (expected ${header.length}, got ${values.length})`)
        continue
      }

      const row: Record<string, any> = {}
      header.forEach((col, idx) => {
        row[col] = values[idx] || ''
      })

      // Build prompt object using mapped column names
      const prompt: any = {
        title: row[titleColumn],
        prompt_text: row[promptColumn],
        category: categoryColumn ? (row[categoryColumn] || null) : null,
        use_case: useCaseColumn ? (row[useCaseColumn] || null) : null,
        suggested_model: modelColumn ? (row[modelColumn] || null) : null,
        difficulty_level: difficultyColumn ? (row[difficultyColumn] || null) : null,
        is_active: true, // Always active by default
        is_featured: false // Never featured by default (only one used per day)
      }

      if (prompt.title && prompt.prompt_text) {
        prompts.push(prompt)
      }
    }

    if (prompts.length === 0) {
      return NextResponse.json({ error: 'No valid prompts found in CSV' }, { status: 400 })
    }

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    }

    // Add newsletter_id and times_used to all prompts
    const promptsWithNewsletterId = prompts.map(prompt => ({
      ...prompt,
      newsletter_id: newsletter.id,
      times_used: 0
    }))

    // Insert prompts into database
    const { data, error } = await supabaseAdmin
      .from('prompt_ideas')
      .insert(promptsWithNewsletterId)
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
