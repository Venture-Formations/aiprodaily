import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// DELETE - Delete a category
export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'databases/categories/[id]' },
  async ({ params, logger }) => {
    const id = params.id

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
      logger.error({ err: error }, 'Error deleting category')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
