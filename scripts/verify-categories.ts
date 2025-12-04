import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

async function main() {
  // Get all categories with tool counts
  const { data: categories } = await supabase
    .from('directory_categories')
    .select(`
      id,
      name,
      slug,
      directory_categories_tools(tool_id)
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('display_order')

  console.log('=== CATEGORY DISTRIBUTION ===\n')
  let total = 0
  categories?.forEach(cat => {
    const count = cat.directory_categories_tools?.length || 0
    total += count
    console.log(`${cat.name}: ${count} tools`)
  })

  console.log(`\nTotal assignments: ${total}`)
  console.log(`(Tools can be in multiple categories)`)
}

main().catch(console.error)
