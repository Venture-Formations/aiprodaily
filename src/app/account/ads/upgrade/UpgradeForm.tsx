'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Star, Crown, Lock, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

// Pricing constants
const PRICING = {
  paid_placement_monthly: 30,
  paid_placement_yearly: 300,
  featured_monthly: 60,
  featured_yearly: 600,
}

const YEARLY_DISCOUNT_MONTHS = 2

interface UpgradeFormProps {
  tool: {
    id: string
    name: string
    category: string | null
    currentListingType: 'free' | 'paid_placement' | 'featured'
    currentBillingPeriod: 'monthly' | 'yearly' | null
  }
  initialListingType?: 'paid_placement' | 'featured'
  initialBillingPeriod?: 'monthly' | 'yearly'
  categoryHasFeatured: boolean
}

export function UpgradeForm({
  tool,
  initialListingType,
  initialBillingPeriod,
  categoryHasFeatured
}: UpgradeFormProps) {
  const router = useRouter()
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
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  // Can't select featured if category already has one (and it's not this tool)
  const featuredDisabled = categoryHasFeatured && tool.currentListingType !== 'featured'

  // Calculate prices
  const paidPlacementMonthly = PRICING.paid_placement_monthly
  const paidPlacementYearly = PRICING.paid_placement_yearly
  const featuredMonthly = PRICING.featured_monthly
  const featuredYearly = PRICING.featured_yearly

  const currentPrice = selectedType === 'featured'
    ? (selectedPeriod === 'yearly' ? featuredYearly : featuredMonthly)
    : (selectedPeriod === 'yearly' ? paidPlacementYearly : paidPlacementMonthly)

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/account/ads/profile"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Profile Advertising
      </Link>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Listing Type Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Listing Type</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Paid Placement */}
          <button
            type="button"
            onClick={() => setSelectedType('paid_placement')}
            disabled={tool.currentListingType === 'paid_placement'}
            className={`relative p-6 rounded-xl border-2 text-left transition-all ${
              tool.currentListingType === 'paid_placement'
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                : selectedType === 'paid_placement'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {tool.currentListingType === 'paid_placement' && (
              <span className="absolute top-3 right-3 text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                Current Plan
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedType === 'paid_placement' ? 'bg-blue-600' : 'bg-blue-100'
              }`}>
                <Star className={`w-5 h-5 ${
                  selectedType === 'paid_placement' ? 'text-white fill-current' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Paid Placement</h3>
                <p className="text-sm text-slate-500">${paidPlacementMonthly}/month</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-500" />
                Page 1 placement
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-500" />
                Priority in search results
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-500" />
                Enhanced visibility
              </li>
            </ul>
          </button>

          {/* Featured */}
          <button
            type="button"
            onClick={() => !featuredDisabled && setSelectedType('featured')}
            disabled={featuredDisabled || tool.currentListingType === 'featured'}
            className={`relative p-6 rounded-xl border-2 text-left transition-all ${
              tool.currentListingType === 'featured'
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                : featuredDisabled
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                  : selectedType === 'featured'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {tool.currentListingType === 'featured' && (
              <span className="absolute top-3 right-3 text-xs bg-amber-200 text-amber-700 px-2 py-1 rounded-full">
                Current Plan
              </span>
            )}
            {featuredDisabled && tool.currentListingType !== 'featured' && (
              <span className="absolute top-3 right-3 text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Unavailable
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedType === 'featured' && !featuredDisabled ? 'bg-amber-500' : 'bg-amber-100'
              }`}>
                <Crown className={`w-5 h-5 ${
                  selectedType === 'featured' && !featuredDisabled ? 'text-white' : 'text-amber-600'
                }`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Featured</h3>
                <p className="text-sm text-slate-500">${featuredMonthly}/month</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${featuredDisabled ? 'text-slate-400' : 'text-amber-500'}`} />
                #1 position in category
              </li>
              <li className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${featuredDisabled ? 'text-slate-400' : 'text-amber-500'}`} />
                Featured badge & highlighting
              </li>
              <li className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${featuredDisabled ? 'text-slate-400' : 'text-amber-500'}`} />
                Maximum visibility
              </li>
            </ul>
            {featuredDisabled && tool.currentListingType !== 'featured' && (
              <p className="mt-3 text-xs text-slate-500">
                Another tool is featured in this category
              </p>
            )}
          </button>
        </div>
      </div>

      {/* Billing Period Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Billing Period</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly */}
          <button
            type="button"
            onClick={() => setSelectedPeriod('monthly')}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              selectedPeriod === 'monthly'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <h3 className="font-semibold text-slate-900 mb-1">Monthly</h3>
            <p className="text-2xl font-bold text-slate-900">
              ${selectedType === 'featured' ? featuredMonthly : paidPlacementMonthly}
              <span className="text-base font-normal text-slate-500">/month</span>
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Flexible monthly billing, cancel anytime
            </p>
          </button>

          {/* Yearly */}
          <button
            type="button"
            onClick={() => setSelectedPeriod('yearly')}
            className={`relative p-6 rounded-xl border-2 text-left transition-all ${
              selectedPeriod === 'yearly'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="absolute -top-3 left-4">
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                Save {YEARLY_DISCOUNT_MONTHS} months
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Yearly</h3>
            <p className="text-2xl font-bold text-slate-900">
              ${selectedType === 'featured' ? featuredYearly : paidPlacementYearly}
              <span className="text-base font-normal text-slate-500">/year</span>
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Pay annually and get {YEARLY_DISCOUNT_MONTHS} months free
            </p>
          </button>
        </div>
      </div>

      {/* Summary & Checkout */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Order Summary</h3>
            <p className="text-slate-300 text-sm">{tool.name}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">${currentPrice}</p>
            <p className="text-slate-300 text-sm">
              {selectedPeriod === 'yearly' ? 'per year' : 'per month'}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Plan</span>
            <span className="font-medium">
              {selectedType === 'featured' ? 'Featured' : 'Paid Placement'}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-300">Billing</span>
            <span className="font-medium capitalize">{selectedPeriod}</span>
          </div>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={isLoading || (tool.currentListingType === selectedType)}
          className="w-full py-3 bg-white text-slate-900 rounded-full font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Redirecting to checkout...
            </>
          ) : (
            'Proceed to Checkout'
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
