import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/ai-apps/export-csv - Export AI applications as CSV
 *
 * Returns CSV with columns: Tool Name, Category, Tool Type
 * Can be directly imported into Google Sheets
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'ai-apps/export-csv' },
  async () => {
    const { data: apps, error } = await supabaseAdmin
      .from('ai_applications')
      .select('app_name, category, tool_type')
      .eq('is_active', true)
      .order('app_name', { ascending: true })

    if (error) throw error

    // Create CSV content
    const csvLines = ['Tool Name,Category,Tool Type']

    for (const app of apps || []) {
      // Escape fields that might contain commas
      const name = app.app_name?.includes(',')
        ? `"${app.app_name}"`
        : app.app_name || ''
      const category = app.category || ''
      const toolType = app.tool_type || ''

      csvLines.push(`${name},${category},${toolType}`)
    }

    const csv = csvLines.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="ai-tools-categories.csv"'
      }
    })
  }
)
