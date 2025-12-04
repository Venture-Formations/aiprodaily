import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

async function main() {
  // Get all tools
  const { data: tools } = await supabase
    .from('tools_directory')
    .select('id, tool_name, description')
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('tool_name')

  // Get all category assignments
  const { data: assignments } = await supabase
    .from('directory_categories_tools')
    .select('tool_id')

  const assignedToolIds = new Set(assignments?.map(a => a.tool_id) || [])

  // Find unassigned tools
  const unassigned = tools?.filter(t => !assignedToolIds.has(t.id)) || []

  console.log(`Total tools: ${tools?.length || 0}`)
  console.log(`Assigned tools: ${assignedToolIds.size}`)
  console.log(`Unassigned tools: ${unassigned.length}\n`)

  if (unassigned.length > 0) {
    console.log('=== UNASSIGNED TOOLS ===')
    unassigned.forEach(t => {
      const desc = t.description?.substring(0, 80) || ''
      console.log(`${t.tool_name} | ${desc}`)
    })
  }
}

main().catch(console.error)
