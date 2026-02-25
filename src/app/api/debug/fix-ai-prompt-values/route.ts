import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/fix-ai-prompt-values' },
  async ({ logger }) => {
    // Get the active publication
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Fetch AI prompts
    const { data: prompts, error } = await supabaseAdmin
      .from('publication_settings')
      .select('id, key, value')
      .eq('publication_id', newsletter.id)
      .like('key', 'ai_prompt_%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const updates: { id: string; key: string; oldValue: string; newValue: string }[] = []
    const diagnostics: any[] = []

    for (const prompt of prompts || []) {
      const value = prompt.value

      const diag: any = {
        key: prompt.key,
        first_char: value?.charAt(0),
        last_char: value?.charAt(value.length - 1),
        length: value?.length
      }

      // Check if value is a JSON string (starts with " when parsed as text)
      // This would mean it's double-stringified
      if (typeof value === 'string' && value.length > 0) {
        try {
          // Try to parse it as JSON
          const parsed = JSON.parse(value)

          diag.parsed_type = typeof parsed

          // If it parsed to a string, that's the double-stringify issue
          if (typeof parsed === 'string') {
            diag.issue = 'double_stringified'
            diag.inner_first_char = parsed.charAt(0)

            // The parsed string should be valid JSON (the actual prompt)
            try {
              JSON.parse(parsed)
              diag.inner_is_valid_json = true
              // This is the fix - use the inner string
              updates.push({
                id: prompt.id,
                key: prompt.key,
                oldValue: value.substring(0, 100) + '...',
                newValue: parsed
              })
            } catch (e) {
              diag.inner_is_valid_json = false
              diag.inner_error = (e as Error).message
            }
          } else if (typeof parsed === 'object') {
            diag.issue = 'none - already valid JSON object'
          }
        } catch (e) {
          diag.parse_error = (e as Error).message

          // Check if it contains literal \n sequences (not actual newlines)
          // This causes "Expected property name" errors
          if (value.includes('\\n') || value.includes('\\t') || value.includes('\\"')) {
            diag.issue = 'contains_escaped_chars'

            // Try to fix by replacing escaped sequences with actual chars
            const unescaped = value
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')

            try {
              JSON.parse(unescaped)
              diag.fixed_is_valid = true
              updates.push({
                id: prompt.id,
                key: prompt.key,
                oldValue: value.substring(0, 100) + '...',
                newValue: unescaped
              })
            } catch (e2) {
              diag.fixed_is_valid = false
              diag.fix_error = (e2 as Error).message
            }
          } else {
            diag.issue = 'invalid_json'
          }
        }
      }

      diagnostics.push(diag)
    }

    // Apply fixes if any found
    if (updates.length > 0) {
      let fixedCount = 0
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from('publication_settings')
          .update({ value: update.newValue, updated_at: new Date().toISOString() })
          .eq('id', update.id)

        if (!updateError) {
          fixedCount++
        }
      }

      return NextResponse.json({
        message: `Fixed ${fixedCount} AI prompts`,
        totalPrompts: prompts?.length || 0,
        fixedCount,
        diagnostics,
        updates: updates.map(u => ({ key: u.key }))
      })
    }

    return NextResponse.json({
      message: 'No AI prompts need fixing',
      totalPrompts: prompts?.length || 0,
      diagnostics
    })
  }
)
