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
