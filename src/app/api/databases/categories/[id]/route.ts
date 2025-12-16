import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DELETE - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Check if any articles are using this category
    const { data: articlesUsingCategory } = await supabaseAdmin
      .from('manual_articles')
      .select('id')
      .eq('category_id', id)
      .limit(1)

    if (articlesUsingCategory && articlesUsingCategory.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that is in use by articles' },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin
      .from('article_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API] Error deleting category:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] Category DELETE error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
