import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function GET() {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('directory_categories')
      .select('id, name, slug')
      .eq('publication_id', PUBLICATION_ID)
      .order('name')

    if (error) {
      console.error('[Categories] Failed to fetch categories:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ categories })
  } catch (err) {
    console.error('[Categories] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
