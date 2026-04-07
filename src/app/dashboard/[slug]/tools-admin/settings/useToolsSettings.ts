'use client'

import { useState, useEffect } from 'react'

interface PricingSettings {
  paidPlacementPrice: number
  featuredPrice: number
  yearlyDiscountMonths: number
}

export function useToolsSettings() {
  const [settings, setSettings] = useState<PricingSettings>({
    paidPlacementPrice: 30,
    featuredPrice: 60,
    yearlyDiscountMonths: 2
  })
  const [originalSettings, setOriginalSettings] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/tools/settings')
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        setOriginalSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tools/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (data.success) {
        setOriginalSettings(settings)
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }
    setSaving(false)
  }

  function handleReset() {
    if (originalSettings) {
      setSettings(originalSettings)
    }
  }

  const hasChanges = originalSettings && (
    settings.paidPlacementPrice !== originalSettings.paidPlacementPrice ||
    settings.featuredPrice !== originalSettings.featuredPrice ||
    settings.yearlyDiscountMonths !== originalSettings.yearlyDiscountMonths
  )

  const paidPlacementYearlyPrice = settings.paidPlacementPrice * (12 - settings.yearlyDiscountMonths)
  const featuredYearlyPrice = settings.featuredPrice * (12 - settings.yearlyDiscountMonths)

  return {
    settings,
    setSettings,
    loading,
    saving,
    message,
    handleSave,
    handleReset,
    hasChanges,
    paidPlacementYearlyPrice,
    featuredYearlyPrice
  }
}
