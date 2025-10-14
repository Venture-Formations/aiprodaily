import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - List all prompt ideas
export async function GET(request: NextRequest) {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching prompt ideas:', error)
      return NextResponse.json({ error: 'Failed to fetch prompt ideas' }, { status: 500 })
    }

    return NextResponse.json({ prompts: prompts || [] })
  } catch (error) {
    console.error('Prompt ideas GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new prompt idea
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    }

    const { data: prompt, error } = await supabaseAdmin
      .from('prompt_ideas')
      .insert({
        newsletter_id: newsletter.id,
        title: body.title,
        prompt_text: body.prompt_text,
        category: body.category || null,
        use_case: body.use_case || null,
        suggested_model: body.suggested_model || null,
        difficulty_level: body.difficulty_level || null,
        is_featured: body.is_featured || false,
        is_active: body.is_active !== undefined ? body.is_active : true,
        display_order: body.display_order || null,
        times_used: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating prompt idea:', error)
      return NextResponse.json({ error: 'Failed to create prompt idea' }, { status: 500 })
    }

    return NextResponse.json({ prompt }, { status: 201 })
  } catch (error) {
    console.error('Prompt ideas POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
