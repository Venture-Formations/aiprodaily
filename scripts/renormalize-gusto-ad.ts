import { createClient } from '@supabase/supabase-js'
import { normalizeEmailHtml } from '../src/lib/html-normalizer'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function renormalizeAd() {
  // Get the ad
  const { data: ad } = await supabase
    .from('advertisements')
    .select('id, body')
    .eq('title', 'Gusto: The all-in-one payroll, benefits, and HR platform.')
    .single()

  if (!ad) {
    console.log('Ad not found')
    return
  }

  console.log('Original HTML:')
  console.log(ad.body)
  console.log('\n--- Normalizing ---\n')

  // Normalize the HTML
  const normalized = normalizeEmailHtml(ad.body)
  console.log('Normalized HTML:')
  console.log(normalized)

  // Update the ad
  const { error } = await supabase
    .from('advertisements')
    .update({ body: normalized, updated_at: new Date().toISOString() })
    .eq('id', ad.id)

  if (error) {
    console.error('Error updating:', error)
  } else {
    console.log('\n✓ Ad updated successfully!')
  }
}

renormalizeAd()
