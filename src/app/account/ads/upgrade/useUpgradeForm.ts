'use client'

import { useState } from 'react'

interface UpgradeFormTool {
  id: string
  currentListingType: 'free' | 'paid_placement' | 'featured'
}

interface UpgradeFormPricing {
  paidPlacementMonthly: number
  paidPlacementYearly: number
  featuredMonthly: number
  featuredYearly: number
}

export function useUpgradeForm(
  tool: UpgradeFormTool,
  pricing: UpgradeFormPricing,
  categoryHasFeatured: boolean,
  initialListingType?: 'paid_placement' | 'featured',
  initialBillingPeriod?: 'monthly' | 'yearly'
) {
  const [selectedType, setSelectedType] = useState<'paid_placement' | 'featured'>(
    initialListingType || 'paid_placement'
  )
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>(
    initialBillingPeriod || 'monthly'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/account/tools/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          listingType: selectedType,
          billingPeriod: selectedPeriod
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  const featuredDisabled = categoryHasFeatured && tool.currentListingType !== 'featured'

  const currentPrice = selectedType === 'featured'
    ? (selectedPeriod === 'yearly' ? pricing.featuredYearly : pricing.featuredMonthly)
    : (selectedPeriod === 'yearly' ? pricing.paidPlacementYearly : pricing.paidPlacementMonthly)

  return {
    selectedType,
    setSelectedType,
    selectedPeriod,
    setSelectedPeriod,
    isLoading,
    error,
    handleUpgrade,
    featuredDisabled,
    currentPrice
  }
}
