import { supabaseAdmin } from '@/lib/supabase'

export interface DiningSelection {
  deals: any[]
  message: string
}

/**
 * Select deals with business limits: max N deals per business, ensure minimum total
 * @param deals - Available deals (should be pre-sorted by priority)
 * @param minTotal - Minimum total deals to select (default 8)
 * @param maxPerBusiness - Maximum deals per business (default 2)
 */
function selectDealsWithBusinessLimit(deals: any[], minTotal: number = 8, maxPerBusiness: number = 2): any[] {
  const selected: any[] = []
  const businessCounts: { [businessName: string]: number } = {}

  // First pass: Apply business limits
  for (const deal of deals) {
    const businessName = deal.business_name || 'Unknown'
    const currentCount = businessCounts[businessName] || 0

    if (currentCount < maxPerBusiness) {
      selected.push(deal)
      businessCounts[businessName] = currentCount + 1
    }

    // Stop if we have enough deals
    if (selected.length >= minTotal) {
      break
    }
  }

  // Second pass: If we don't have enough deals, relax the business limit
  if (selected.length < minTotal) {
    const remaining = deals.filter(deal => !selected.includes(deal))
    const needed = minTotal - selected.length

    // Add remaining deals regardless of business limits to reach minimum
    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
      selected.push(remaining[i])
    }
  }

  return selected
}

export async function selectDiningDealsForCampaign(campaignId: string, campaignDate: Date): Promise<DiningSelection> {
  try {
    // Get the day of the week for the campaign date
    const dayOfWeek = campaignDate.toLocaleDateString('en-US', { weekday: 'long' })

    // Get all active deals for this day of the week
    const { data: availableDeals, error: dealsError } = await supabaseAdmin
      .from('dining_deals')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('is_featured', { ascending: false }) // Featured deals first
      .order('business_name', { ascending: true }) // Then alphabetical

    if (dealsError) {
      console.error('Error fetching dining deals:', dealsError)
      throw new Error('Failed to fetch dining deals')
    }

    if (!availableDeals || availableDeals.length === 0) {
      return {
        deals: [],
        message: `No active dining deals found for ${dayOfWeek}`
      }
    }

    // Check if we already have selections for this campaign
    const { data: existingSelections, error: selectionsError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select('*')
      .eq('campaign_id', campaignId)

    if (selectionsError) {
      console.error('Error checking existing dining selections:', selectionsError)
      throw new Error('Failed to check existing dining selections')
    }

    if (existingSelections && existingSelections.length > 0) {
      // Get the deal details for existing selections in their original selection order
      const { data: selectedDeals, error: selectedError } = await supabaseAdmin
        .from('campaign_dining_selections')
        .select(`
          *,
          dining_deal:dining_deals(*)
        `)
        .eq('campaign_id', campaignId)
        .order('selection_order', { ascending: true })

      if (selectedError) {
        console.error('Error fetching selected deals:', selectedError)
        throw new Error('Failed to fetch selected deals')
      }

      // Extract the dining deals from the joined data, preserving selection order
      const deals = selectedDeals?.map(s => ({
        ...s.dining_deal,
        is_featured_in_campaign: s.is_featured_in_campaign,
        selection_order: s.selection_order
      })) || []

      return {
        deals: deals,
        message: `Using existing ${deals.length} dining deals for ${dayOfWeek} (in original random order)`
      }
    }

    // Separate paid placements - these are GUARANTEED selections
    const paidPlacementDeals = availableDeals.filter(deal => deal.paid_placement)
    const nonPaidDeals = availableDeals.filter(deal => !deal.paid_placement)

    // Randomize the non-paid deals while preserving featured priority
    const featuredDeals = nonPaidDeals.filter(deal => deal.is_featured)
    const nonFeaturedDeals = nonPaidDeals.filter(deal => !deal.is_featured)

    // Shuffle non-featured, non-paid deals randomly
    const shuffledNonFeatured = [...nonFeaturedDeals].sort(() => 0.5 - Math.random())

    // Combine: paid placements first, then featured, then shuffled non-featured
    const prioritizedDeals = [...paidPlacementDeals, ...featuredDeals, ...shuffledNonFeatured]

    // Calculate how many slots we have: 8 total, minus guaranteed paid placements
    const spotsAvailable = 8
    const guaranteedPaidCount = paidPlacementDeals.length

    if (guaranteedPaidCount > spotsAvailable) {
      console.warn(`Warning: ${guaranteedPaidCount} paid placements exceed ${spotsAvailable} spots. All will be included.`)
    }

    // Select deals: all paid placements + fill remaining slots with business limits
    const selectedDeals = selectDealsWithBusinessLimit(prioritizedDeals, Math.max(8, guaranteedPaidCount), 2)

    // Finally randomize the selected deals order (except keep paid placements and featured first)
    const selectedPaid = selectedDeals.filter(deal => deal.paid_placement)
    const selectedFeatured = selectedDeals.filter(deal => deal.is_featured && !deal.paid_placement)
    const selectedNonFeatured = selectedDeals.filter(deal => !deal.is_featured && !deal.paid_placement)
    const shuffledSelected = [...selectedNonFeatured].sort(() => 0.5 - Math.random())
    const finalOrderedDeals = [...selectedPaid, ...selectedFeatured, ...shuffledSelected]

    // If no deals are featured, mark the first one as featured
    if (finalOrderedDeals.length > 0 && !finalOrderedDeals.some(deal => deal.is_featured)) {
      // Update the first deal to be featured (temporarily for this campaign)
      const firstDeal = finalOrderedDeals[0]
      firstDeal.is_featured = true
    }

    // Insert campaign selections with proper ordering
    const campaignSelections = finalOrderedDeals.map((deal, index) => ({
      campaign_id: campaignId,
      deal_id: deal.id,
      selection_order: index + 1,
      is_featured_in_campaign: deal.is_featured
    }))

    const { error: insertError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .insert(campaignSelections)

    if (insertError) {
      console.error('Error inserting dining selections:', insertError)
      throw new Error('Failed to save dining selections')
    }

    // Count businesses to show in message
    const businessCounts: { [businessName: string]: number } = {}
    finalOrderedDeals.forEach(deal => {
      const businessName = deal.business_name || 'Unknown'
      businessCounts[businessName] = (businessCounts[businessName] || 0) + 1
    })

    const businessesWithMultiple = Object.entries(businessCounts)
      .filter(([_, count]) => count > 1)
      .length

    const paidCount = finalOrderedDeals.filter(d => d.paid_placement).length
    const featuredCount = finalOrderedDeals.filter(d => d.is_featured).length

    return {
      deals: finalOrderedDeals,
      message: `Selected ${finalOrderedDeals.length} dining deals for ${dayOfWeek} (${paidCount} paid placements, ${featuredCount} featured, max 2 per business, randomized order${businessesWithMultiple > 0 ? `, ${businessesWithMultiple} businesses with multiple deals` : ''})`
    }

  } catch (error) {
    console.error('Error in selectDiningDealsForCampaign:', error)
    return {
      deals: [],
      message: `Error selecting dining deals: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export async function getDiningDealsForCampaign(campaignId: string): Promise<any[]> {
  try {
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('campaign_dining_selections')
      .select(`
        *,
        dining_deal:dining_deals(*)
      `)
      .eq('campaign_id', campaignId)
      .order('selection_order', { ascending: true })

    if (selectionsError) {
      console.error('Error fetching campaign dining selections:', selectionsError)
      return []
    }

    if (!selections || selections.length === 0) {
      return []
    }

    // Extract deals and preserve the selection order
    const deals = selections
      .map(s => ({
        ...s.dining_deal,
        is_featured_in_campaign: s.is_featured_in_campaign,
        selection_order: s.selection_order
      }))

    return deals
  } catch (error) {
    console.error('Error in getDiningDealsForCampaign:', error)
    return []
  }
}