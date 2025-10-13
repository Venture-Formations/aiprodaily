import { supabaseAdmin } from '@/lib/supabase'
import { VrboListing, CampaignVrboSelection, VrboSelectionState } from '@/types/database'

/**
 * Fisher-Yates shuffle algorithm for random ordering
 * Same as the Google Apps Script implementation
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array] // Create a copy
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Get or create selection state for a listing type
 */
async function getSelectionState(listingType: 'Local' | 'Greater'): Promise<VrboSelectionState> {
  const { data: state, error } = await supabaseAdmin
    .from('vrbo_selection_state')
    .select('*')
    .eq('listing_type', listingType)
    .single()

  if (error || !state) {
    // Create initial state
    const { data: newState, error: createError } = await supabaseAdmin
      .from('vrbo_selection_state')
      .insert([{
        listing_type: listingType,
        current_index: 0,
        shuffle_order: []
      }])
      .select()
      .single()

    if (createError || !newState) {
      throw new Error(`Failed to create selection state for ${listingType}`)
    }

    return newState
  }

  return state
}

/**
 * Update selection state
 */
async function updateSelectionState(
  listingType: 'Local' | 'Greater',
  currentIndex: number,
  shuffleOrder: string[]
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('vrbo_selection_state')
    .upsert([{
      listing_type: listingType,
      current_index: currentIndex,
      shuffle_order: shuffleOrder
    }], {
      onConflict: 'listing_type'
    })

  if (error) {
    throw new Error(`Failed to update selection state for ${listingType}: ${error.message}`)
  }
}

/**
 * Select VRBO properties for a campaign using sequential algorithm
 * Implements the same logic as the Google Apps Script
 */
export async function selectPropertiesForCampaign(campaignId: string): Promise<{
  selected: VrboListing[]
  message: string
}> {
  try {
    console.log('=== STARTING VRBO PROPERTY SELECTOR ===')
    console.log('Campaign ID:', campaignId)

    // Check if properties are already selected for this campaign
    const { data: existingSelections } = await supabaseAdmin
      .from('campaign_vrbo_selections')
      .select('*')
      .eq('campaign_id', campaignId)

    if (existingSelections && existingSelections.length > 0) {
      console.log('Properties already selected for this campaign')
      // Fetch the actual listings
      const { data: selectedListings } = await supabaseAdmin
        .from('vrbo_listings')
        .select('*')
        .in('id', existingSelections.map(s => s.listing_id))

      return {
        selected: selectedListings || [],
        message: 'Properties already selected for this campaign'
      }
    }

    // Get all active listings by type
    const { data: localProperties, error: localError } = await supabaseAdmin
      .from('vrbo_listings')
      .select('*')
      .eq('listing_type', 'Local')
      .eq('is_active', true)

    const { data: greaterProperties, error: greaterError } = await supabaseAdmin
      .from('vrbo_listings')
      .select('*')
      .eq('listing_type', 'Greater')
      .eq('is_active', true)

    if (localError || greaterError) {
      throw new Error('Failed to fetch VRBO listings')
    }

    console.log(`Found ${localProperties?.length || 0} Local and ${greaterProperties?.length || 0} Greater properties`)

    if (!localProperties?.length && !greaterProperties?.length) {
      return {
        selected: [],
        message: 'No active VRBO listings found'
      }
    }

    // Get current selection states
    const localState = await getSelectionState('Local')
    const greaterState = await getSelectionState('Greater')

    let localIndex = localState.current_index
    let greaterIndex = greaterState.current_index
    let localShuffle = localState.shuffle_order
    let greaterShuffle = greaterState.shuffle_order

    // Create new shuffles if needed (first run or exhausted)
    if (!localProperties?.length) {
      localShuffle = []
    } else if (localShuffle.length === 0 || localIndex >= localShuffle.length) {
      const activeLocalIds = localProperties.map(p => p.id)
      localShuffle = shuffleArray(activeLocalIds)
      localIndex = 0
      console.log('Created new Local shuffle order')
    }

    if (!greaterProperties?.length) {
      greaterShuffle = []
    } else if (greaterShuffle.length === 0 || greaterIndex >= greaterShuffle.length) {
      const activeGreaterIds = greaterProperties.map(p => p.id)
      greaterShuffle = shuffleArray(activeGreaterIds)
      greaterIndex = 0
      console.log('Created new Greater shuffle order')
    }

    console.log(`Current shuffle positions - Local: ${localIndex}/${localShuffle.length}, Greater: ${greaterIndex}/${greaterShuffle.length}`)

    // Select properties using shuffled order (1 Local, 2 Greater)
    const selectedProperties: VrboListing[] = []
    const selections: Array<{ listing_id: string; selection_order: number }> = []

    // Select 1 Local property
    if (localProperties?.length && localIndex < localShuffle.length) {
      const selectedId = localShuffle[localIndex]
      const selectedLocal = localProperties.find(p => p.id === selectedId)
      if (selectedLocal) {
        selectedProperties.push(selectedLocal)
        selections.push({ listing_id: selectedId, selection_order: 1 })
        localIndex++
        console.log(`Selected Local: ${selectedLocal.title}`)
      }
    }

    // Select 2 Greater properties
    if (greaterProperties?.length) {
      for (let i = 0; i < 2 && greaterIndex < greaterShuffle.length; i++) {
        const selectedId = greaterShuffle[greaterIndex]
        const selectedGreater = greaterProperties.find(p => p.id === selectedId)
        if (selectedGreater) {
          selectedProperties.push(selectedGreater)
          selections.push({ listing_id: selectedId, selection_order: selectedProperties.length })
          greaterIndex++
          console.log(`Selected Greater: ${selectedGreater.title}`)
        }
      }
    }

    if (selectedProperties.length === 0) {
      return {
        selected: [],
        message: 'No valid properties found for selection'
      }
    }

    // Save selections to database
    const { error: insertError } = await supabaseAdmin
      .from('campaign_vrbo_selections')
      .insert(selections.map(s => ({
        ...s,
        campaign_id: campaignId
      })))

    if (insertError) {
      throw new Error(`Failed to save property selections: ${insertError.message}`)
    }

    // Update selection states
    await updateSelectionState('Local', localIndex, localShuffle)
    await updateSelectionState('Greater', greaterIndex, greaterShuffle)

    console.log(`Successfully selected ${selectedProperties.length} properties for campaign ${campaignId}`)

    return {
      selected: selectedProperties,
      message: `Selected ${selectedProperties.length} properties (${selections.filter(s => s.selection_order === 1).length} Local, ${selections.filter(s => s.selection_order > 1).length} Greater)`
    }

  } catch (error) {
    console.error('VRBO property selection error:', error)
    throw error
  }
}

/**
 * Get selected properties for a campaign
 */
export async function getSelectedPropertiesForCampaign(campaignId: string): Promise<VrboListing[]> {
  const { data: selections, error } = await supabaseAdmin
    .from('campaign_vrbo_selections')
    .select(`
      *,
      listing:vrbo_listings(*)
    `)
    .eq('campaign_id', campaignId)
    .order('selection_order', { ascending: true })

  if (error) {
    console.error('Error fetching selected properties:', error)
    return []
  }

  return selections?.map(s => s.listing).filter(Boolean) || []
}

/**
 * Reset selection indices (equivalent to resetIndices() in Google Apps Script)
 */
export async function resetSelectionIndices(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('vrbo_selection_state')
    .delete()
    .neq('id', 'dummy') // Delete all records

  if (error) {
    throw new Error(`Failed to reset selection indices: ${error.message}`)
  }

  console.log('Selection indices reset - will create new random orders on next run')
}

/**
 * Check current selection indices (equivalent to checkCurrentIndices() in Google Apps Script)
 */
export async function checkCurrentIndices(): Promise<{
  localIndex: number
  greaterIndex: number
}> {
  const localState = await getSelectionState('Local')
  const greaterState = await getSelectionState('Greater')

  console.log(`Current indices - Local: ${localState.current_index}, Greater: ${greaterState.current_index}`)

  return {
    localIndex: localState.current_index,
    greaterIndex: greaterState.current_index
  }
}