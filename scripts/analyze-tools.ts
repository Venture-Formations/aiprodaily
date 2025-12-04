import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

async function main() {
  // Get all categories
  const { data: categories } = await supabase
    .from('directory_categories')
    .select('id, name, slug')
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('name')

  console.log('\n=== CURRENT CATEGORIES ===')
  categories?.forEach(c => console.log(`- ${c.name} (${c.slug})`))

  // Get all tools with their categories
  const { data: tools } = await supabase
    .from('tools_directory')
    .select(`
      id,
      tool_name,
      description,
      tagline,
      directory_categories_tools(
        category:directory_categories(name)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('tool_name')

  console.log('\n=== ALL TOOLS (compact) ===')
  tools?.forEach(tool => {
    const cats = tool.directory_categories_tools?.map((ct: any) => ct.category?.name).filter(Boolean).join(', ') || 'NONE'
    const desc = tool.description?.substring(0, 100) || ''
    console.log(`${tool.tool_name} | ${cats} | ${desc}`)
  })

  console.log(`\n\nTotal tools: ${tools?.length || 0}`)
  console.log(`Total categories: ${categories?.length || 0}`)
}

main().catch(console.error)
