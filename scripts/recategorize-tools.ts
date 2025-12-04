import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

// New categories to create
const NEW_CATEGORIES = [
  { name: 'Bookkeeping & Reconciliation', slug: 'bookkeeping-reconciliation', description: 'Automated transaction coding, reconciliation, journal entries', display_order: 1 },
  { name: 'Accounts Payable (AP)', slug: 'accounts-payable', description: 'Invoice processing, bill pay, vendor payments', display_order: 2 },
  { name: 'Accounts Receivable (AR)', slug: 'accounts-receivable', description: 'Collections, invoicing, payment tracking', display_order: 3 },
  { name: 'Tax Preparation', slug: 'tax-preparation', description: 'Tax workflows, compliance, preparation tools', display_order: 4 },
  { name: 'Audit & Compliance', slug: 'audit-compliance', description: 'Audit automation, GRC, risk detection', display_order: 5 },
  { name: 'Financial Close', slug: 'financial-close', description: 'Month-end close, consolidation, reporting', display_order: 6 },
  { name: 'FP&A & Forecasting', slug: 'fpa-forecasting', description: 'Budgeting, forecasting, financial planning', display_order: 7 },
  { name: 'Document & Data Extraction', slug: 'document-extraction', description: 'OCR, receipt scanning, PDF processing', display_order: 8 },
  { name: 'Client Communication', slug: 'client-communication', description: 'Client portals, secure messaging, document collection', display_order: 9 },
  { name: 'Marketing & Lead Gen', slug: 'marketing-lead-gen', description: 'Email campaigns, content creation, lead generation', display_order: 10 },
  { name: 'Meeting & Transcription', slug: 'meeting-transcription', description: 'Meeting notes, transcription, call recording', display_order: 11 },
  { name: 'Spreadsheet & Excel Tools', slug: 'spreadsheet-tools', description: 'Excel automation, formula generation, Google Sheets', display_order: 12 },
  { name: 'Task & Project Management', slug: 'task-management', description: 'Workflow management, scheduling, team coordination', display_order: 13 },
  { name: 'Practice Management', slug: 'practice-management', description: 'Full accounting practice software', display_order: 14 },
  { name: 'AI Assistants & Research', slug: 'ai-assistants', description: 'General AI chatbots, document Q&A, research tools', display_order: 15 },
  { name: 'HR & Hiring', slug: 'hr-hiring', description: 'Recruiting, onboarding, HR management', display_order: 16 },
  { name: 'Expense Management', slug: 'expense-management', description: 'Expense tracking, travel management, receipt capture', display_order: 17 },
]

// Tool to category mapping based on analysis
// Each tool can have multiple categories
const TOOL_CATEGORIES: Record<string, string[]> = {
  // Bookkeeping & Reconciliation
  'Booke AI': ['bookkeeping-reconciliation'],
  'Botkeeper': ['bookkeeping-reconciliation'],
  'Digits': ['bookkeeping-reconciliation'],
  'Double': ['bookkeeping-reconciliation'],
  'Kick': ['bookkeeping-reconciliation'],
  'Fiskl': ['bookkeeping-reconciliation'],
  'Circler': ['bookkeeping-reconciliation'],
  'Cashflowy': ['bookkeeping-reconciliation'],
  'cc: Monet': ['bookkeeping-reconciliation'],
  'Bkper Sheets': ['bookkeeping-reconciliation', 'spreadsheet-tools'],
  'Jenesys': ['bookkeeping-reconciliation'],
  'Ledger IQ': ['bookkeeping-reconciliation'],
  'Otto AI': ['bookkeeping-reconciliation', 'tax-preparation'],
  'Synder': ['bookkeeping-reconciliation'],
  'Truewind': ['bookkeeping-reconciliation'],
  'Tyms': ['bookkeeping-reconciliation'],
  'Uplinq': ['bookkeeping-reconciliation', 'tax-preparation'],
  'Smart Clerk': ['bookkeeping-reconciliation', 'document-extraction'],
  'Simetrik': ['bookkeeping-reconciliation', 'financial-close'],

  // Accounts Payable (AP)
  'Affinda': ['accounts-payable', 'document-extraction'],
  'AvidXchange': ['accounts-payable'],
  'Basware': ['accounts-payable'],
  'Stampli': ['accounts-payable'],
  'Vic.ai': ['accounts-payable'],
  'Yooz': ['accounts-payable'],
  'Tipalti': ['accounts-payable'],
  'Ottimate': ['accounts-payable'],
  'Vroozi': ['accounts-payable'],
  'Melio': ['accounts-payable'],
  'Coast': ['accounts-payable', 'accounts-receivable'],
  'HighRadius': ['accounts-payable', 'accounts-receivable'],
  'Serrala': ['accounts-payable', 'accounts-receivable'],
  'InvoiceClip': ['accounts-payable', 'document-extraction'],

  // Accounts Receivable (AR)
  'Billtrust': ['accounts-receivable'],
  'Gaviti': ['accounts-receivable'],
  'Versapay': ['accounts-receivable'],
  'LedgerUp': ['accounts-receivable'],
  'Inwisely': ['accounts-receivable'],

  // Tax Preparation
  'Black Ore': ['tax-preparation'],
  'CPA Pilot': ['tax-preparation', 'ai-assistants'],
  'Taxing': ['tax-preparation', 'client-communication'],
  'Jupid': ['tax-preparation', 'bookkeeping-reconciliation'],
  'CCH Axcess Expert AI (Wolters Kluwer)': ['tax-preparation', 'ai-assistants'],
  'EY Taxmann.AI': ['tax-preparation', 'ai-assistants'],

  // Audit & Compliance
  'AuditBoard': ['audit-compliance'],
  'DataSnipper': ['audit-compliance'],
  'MindBridge': ['audit-compliance'],
  'KPMG Clara': ['audit-compliance'],
  'CoCounsel Audit (Thomson Reuters)': ['audit-compliance', 'ai-assistants'],
  'XBert': ['audit-compliance', 'bookkeeping-reconciliation'],
  'Xenett': ['audit-compliance', 'financial-close'],
  'PracticeProtect': ['audit-compliance', 'practice-management'],

  // Financial Close
  'BlackLine': ['financial-close'],
  'Floqast': ['financial-close'],
  'Numeric': ['financial-close'],
  'Nominal': ['financial-close'],
  'Bellaire': ['financial-close'],
  'Netgain': ['financial-close'],
  'Rillet': ['financial-close'],

  // FP&A & Forecasting
  'Datarails': ['fpa-forecasting'],
  'Anaplan': ['fpa-forecasting'],
  'Planful': ['fpa-forecasting'],
  'Pigment': ['fpa-forecasting'],
  'Vena Solutions': ['fpa-forecasting'],
  'Drivetrain': ['fpa-forecasting'],
  'OneStream Software': ['fpa-forecasting'],
  'Fuelfinance': ['fpa-forecasting'],
  'Pecunio AI': ['fpa-forecasting'],
  'Laurel': ['fpa-forecasting'],
  'Precanto': ['fpa-forecasting'],
  'PrometAI': ['fpa-forecasting'],
  'Compass': ['fpa-forecasting'],
  'Martus': ['fpa-forecasting'],
  'Monarch': ['fpa-forecasting'],
  'Finpilot': ['fpa-forecasting'],
  'Fintastic': ['fpa-forecasting', 'spreadsheet-tools'],
  'StackAI': ['fpa-forecasting', 'ai-assistants'],

  // Document & Data Extraction
  'Dext': ['document-extraction', 'expense-management'],
  'Nanonets': ['document-extraction'],
  'VisionParser': ['document-extraction'],
  'AI Receipt Tracker': ['document-extraction', 'expense-management'],
  'ReceiptsAI': ['document-extraction', 'expense-management'],
  'ScanRelief': ['document-extraction'],
  'LedgerBox': ['document-extraction'],
  'SenseTask': ['document-extraction'],
  'Tailride': ['document-extraction', 'expense-management'],
  'Daloopa': ['document-extraction'],
  'AskYourPDF': ['document-extraction', 'ai-assistants'],
  'Scribbl': ['document-extraction'],

  // Client Communication
  'Liscio': ['client-communication'],
  'SafeSend': ['client-communication'],
  'CLI3NTS': ['client-communication'],
  'Karbon': ['client-communication', 'task-management'],
  'Client Hub': ['client-communication'],
  'Clivio': ['client-communication'],
  'Assembly': ['client-communication'],
  'Sonny9': ['client-communication'],
  'Silverfin': ['client-communication', 'bookkeeping-reconciliation'],
  'Handwrytten': ['client-communication', 'marketing-lead-gen'],

  // Marketing & Lead Gen
  'AdCreative.ai': ['marketing-lead-gen'],
  'GetResponse': ['marketing-lead-gen'],
  'Instantly': ['marketing-lead-gen'],
  'Reply.io': ['marketing-lead-gen'],
  'Content Bot': ['marketing-lead-gen'],
  'customer.io': ['marketing-lead-gen'],
  'Predis.ai': ['marketing-lead-gen'],
  'Writesonic': ['marketing-lead-gen'],
  'Everneed AI': ['marketing-lead-gen'],
  'Lusha': ['marketing-lead-gen'],
  'Endgame': ['marketing-lead-gen', 'client-communication'],
  'Sellful': ['marketing-lead-gen'],
  'Durable': ['marketing-lead-gen', 'practice-management'],
  'Solidroad': ['client-communication', 'marketing-lead-gen'],

  // Meeting & Transcription
  'Laxis': ['meeting-transcription'],
  'MeetGeek': ['meeting-transcription'],
  'Notta': ['meeting-transcription'],
  'Jinna.ai': ['meeting-transcription'],
  'Aircall': ['meeting-transcription', 'client-communication'],
  'CloudTalk': ['meeting-transcription', 'client-communication'],
  'KrispCall': ['meeting-transcription', 'client-communication'],
  'Notis': ['meeting-transcription'],
  'Demodesk': ['meeting-transcription'],
  'Synthflow AI': ['meeting-transcription', 'client-communication'],

  // Spreadsheet & Excel Tools
  'GPTExcel': ['spreadsheet-tools'],
  'ExcelMaster.ai': ['spreadsheet-tools'],
  'Ajelix': ['spreadsheet-tools'],
  'Macabacus': ['spreadsheet-tools'],
  'G-Accon (for Xero/QBO)': ['spreadsheet-tools'],
  'Coupler.io': ['spreadsheet-tools'],
  'Pigment Connector': ['spreadsheet-tools', 'fpa-forecasting'],
  'Excelmatic': ['spreadsheet-tools'],
  'Spreadsheet Sync (Intuit)': ['spreadsheet-tools'],
  'Tiller Money Feeds': ['spreadsheet-tools', 'bookkeeping-reconciliation'],
  'Rowes AI': ['spreadsheet-tools', 'ai-assistants'],
  'MakersHub': ['spreadsheet-tools'],
  'Endex AI Agent': ['spreadsheet-tools', 'fpa-forecasting'],

  // Task & Project Management
  'ClickUp': ['task-management'],
  'Monday': ['task-management'],
  'Motion': ['task-management'],
  'Sunsama': ['task-management'],
  'Reclaim.ai': ['task-management'],
  'Lindy': ['task-management', 'ai-assistants'],
  'SaneBox': ['task-management'],
  'Superhuman': ['task-management', 'client-communication'],

  // Practice Management
  'Canopy': ['practice-management', 'client-communication'],
  'TaxDome': ['practice-management'],
  'xero': ['practice-management', 'bookkeeping-reconciliation'],
  'Zoho Books': ['practice-management', 'bookkeeping-reconciliation'],
  'Docyt': ['practice-management', 'bookkeeping-reconciliation'],
  'Qoyod': ['practice-management', 'bookkeeping-reconciliation'],
  'zena': ['practice-management'],
  'Zeni': ['practice-management', 'bookkeeping-reconciliation'],

  // AI Assistants & Research
  'Custom GPT': ['ai-assistants'],
  'Julius AI': ['ai-assistants'],
  'Jenni AI': ['ai-assistants'],
  'NoowAI': ['ai-assistants'],
  'FinanceGPT Chat': ['ai-assistants'],
  'Snowfire AI': ['ai-assistants', 'document-extraction'],
  'MindOS': ['ai-assistants'],
  'QuillBot': ['ai-assistants'],
  'Upword': ['ai-assistants'],
  'Fefi': ['ai-assistants', 'client-communication'],

  // HR & Hiring
  'Mega HR': ['hr-hiring'],
  'Skillfully': ['hr-hiring'],
  'Trainual': ['hr-hiring'],
  'Workday Adaptive Planning': ['hr-hiring', 'fpa-forecasting'],
  'Hedy': ['hr-hiring'],

  // Expense Management
  'Ramp': ['expense-management', 'accounts-payable'],
  'Travel Code': ['expense-management'],
  'Vossa: AI expense tracker': ['expense-management'],
  'Tinkery': ['expense-management', 'document-extraction'],

  // Productivity tools - categorize by their main function
  'AI Flowchart': ['task-management'],
  'AiAssit Works': ['ai-assistants'],
  'Airbook': ['fpa-forecasting'],
  'Browse AI': ['ai-assistants'],
  'Cape AI': ['ai-assistants', 'document-extraction'],
  'Descript': ['meeting-transcription'],
  'Doco': ['ai-assistants'],
  'ElevenLabs Inc': ['ai-assistants'],
  'Guidde': ['ai-assistants'],
  'Handover': ['ai-assistants'],
  'JetWriter': ['ai-assistants', 'client-communication'],
  'Murf': ['ai-assistants'],
  'Presenton.ai': ['ai-assistants'],
  'Puzzle': ['task-management'],
  'Remio': ['ai-assistants'],
  'Renamer AI': ['document-extraction'],
  'Rewind': ['ai-assistants'],
  'Segmetrics': ['marketing-lead-gen'],
  'Slides AI': ['ai-assistants'],
  'SlidesPilot': ['ai-assistants'],
  'Table AI': ['client-communication', 'marketing-lead-gen'],
  'Torq': ['task-management'],
  'Tradify': ['practice-management'],
  'Trupeer': ['ai-assistants'],
  'Venngage': ['ai-assistants'],
  'Numra': ['ai-assistants', 'client-communication'],

  // Finance tools - categorize by their main function
  'Sage AI': ['bookkeeping-reconciliation'],
  'Workiva': ['audit-compliance', 'financial-close'],
}

async function main() {
  console.log('Starting category restructure...\n')

  // Step 1: Create new categories
  console.log('=== STEP 1: Creating new categories ===')
  const categoryIds: Record<string, string> = {}

  for (const cat of NEW_CATEGORIES) {
    const { data: existing } = await supabase
      .from('directory_categories')
      .select('id')
      .eq('publication_id', PUBLICATION_ID)
      .eq('slug', cat.slug)
      .single()

    if (existing) {
      console.log(`  Category "${cat.name}" already exists`)
      categoryIds[cat.slug] = existing.id
    } else {
      const { data: newCat, error } = await supabase
        .from('directory_categories')
        .insert({
          publication_id: PUBLICATION_ID,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          display_order: cat.display_order,
          status: 'approved'
        })
        .select('id')
        .single()

      if (error) {
        console.error(`  Error creating "${cat.name}":`, error.message)
      } else {
        console.log(`  Created category "${cat.name}"`)
        categoryIds[cat.slug] = newCat.id
      }
    }
  }

  // Step 2: Get all tools
  console.log('\n=== STEP 2: Fetching all tools ===')
  const { data: tools, error: toolsError } = await supabase
    .from('tools_directory')
    .select('id, tool_name')
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')

  if (toolsError) {
    console.error('Error fetching tools:', toolsError)
    return
  }
  console.log(`  Found ${tools?.length || 0} tools`)

  // Step 3: Clear existing category assignments
  console.log('\n=== STEP 3: Clearing existing category assignments ===')
  const toolIds = tools?.map(t => t.id) || []

  const { error: deleteError } = await supabase
    .from('directory_categories_tools')
    .delete()
    .in('tool_id', toolIds)

  if (deleteError) {
    console.error('Error clearing assignments:', deleteError)
  } else {
    console.log('  Cleared all existing assignments')
  }

  // Step 4: Assign new categories to tools
  console.log('\n=== STEP 4: Assigning new categories ===')
  let assigned = 0
  let unassigned: string[] = []

  for (const tool of tools || []) {
    const categorySlugs = TOOL_CATEGORIES[tool.tool_name]

    if (!categorySlugs || categorySlugs.length === 0) {
      unassigned.push(tool.tool_name)
      continue
    }

    for (const slug of categorySlugs) {
      const categoryId = categoryIds[slug]
      if (!categoryId) {
        console.error(`  Category not found for slug: ${slug}`)
        continue
      }

      const { error: insertError } = await supabase
        .from('directory_categories_tools')
        .insert({
          tool_id: tool.id,
          category_id: categoryId
        })

      if (insertError && !insertError.message.includes('duplicate')) {
        console.error(`  Error assigning ${tool.tool_name} to ${slug}:`, insertError.message)
      } else {
        assigned++
      }
    }
  }
  console.log(`  Assigned ${assigned} category relationships`)

  // Step 5: Report unassigned tools
  if (unassigned.length > 0) {
    console.log('\n=== UNASSIGNED TOOLS (need manual review) ===')
    unassigned.forEach(name => console.log(`  - ${name}`))
  }

  // Step 6: Delete old categories (optional - comment out if you want to keep them)
  console.log('\n=== STEP 6: Checking old categories ===')
  const oldSlugs = ['accounting-system', 'banking', 'client-management', 'finance', 'hr', 'payroll', 'productivity']

  for (const slug of oldSlugs) {
    const { data: cat } = await supabase
      .from('directory_categories')
      .select('id, name')
      .eq('publication_id', PUBLICATION_ID)
      .eq('slug', slug)
      .single()

    if (cat) {
      // Check if any tools are still assigned
      const { count } = await supabase
        .from('directory_categories_tools')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', cat.id)

      if (count === 0) {
        const { error: delError } = await supabase
          .from('directory_categories')
          .delete()
          .eq('id', cat.id)

        if (delError) {
          console.log(`  Could not delete empty category "${cat.name}": ${delError.message}`)
        } else {
          console.log(`  Deleted empty category "${cat.name}"`)
        }
      } else {
        console.log(`  Category "${cat.name}" still has ${count} tools assigned`)
      }
    }
  }

  // Step 7: Delete test tool
  console.log('\n=== STEP 7: Cleaning up test data ===')
  const { error: testToolError } = await supabase
    .from('tools_directory')
    .delete()
    .eq('tool_name', 'Testing the System')
    .eq('publication_id', PUBLICATION_ID)

  if (testToolError) {
    console.log(`  Could not delete test tool: ${testToolError.message}`)
  } else {
    console.log('  Deleted test tool "Testing the System"')
  }

  // Final summary
  console.log('\n=== SUMMARY ===')
  const { data: finalCats } = await supabase
    .from('directory_categories')
    .select('name, slug')
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('display_order')

  console.log(`Total categories: ${finalCats?.length || 0}`)
  finalCats?.forEach(c => console.log(`  - ${c.name} (${c.slug})`))

  console.log(`\nUnassigned tools: ${unassigned.length}`)
  if (unassigned.length > 0) {
    console.log('These tools need manual categorization:')
    unassigned.forEach(name => console.log(`  - ${name}`))
  }

  console.log('\nDone!')
}

main().catch(console.error)
