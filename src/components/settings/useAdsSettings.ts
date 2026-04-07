'use client'

import { useState, useEffect, useMemo } from 'react'

export function useAdsSettings() {
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [adsPerNewsletter, setAdsPerNewsletter] = useState<number>(1)
  const [savingAdsPerNewsletter, setSavingAdsPerNewsletter] = useState(false)
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)

  useEffect(() => {
    loadTiers()
    loadAdsPerNewsletter()
    loadMaxArticles()
  }, [])

  const loadTiers = async () => {
    try {
      const response = await fetch('/api/settings/ad-pricing')
      if (response.ok) {
        const data = await response.json()
        setTiers(data.tiers || [])
      }
    } catch (error) {
      console.error('Failed to load pricing tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAdsPerNewsletter = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        const setting = data.settings.find((s: any) => s.key === 'ads_per_newsletter')
        if (setting) {
          setAdsPerNewsletter(parseInt(setting.value))
        }
      }
    } catch (error) {
      console.error('Failed to load ads per newsletter:', error)
    }
  }

  const saveAdsPerNewsletter = async () => {
    if (adsPerNewsletter < 1 || adsPerNewsletter > 4) {
      alert('Ads per newsletter must be between 1 and 4')
      return
    }

    setSavingAdsPerNewsletter(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads_per_newsletter: adsPerNewsletter.toString()
        })
      })

      if (response.ok) {
        setMessage('Ads per newsletter updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update setting')
      }
    } catch (error) {
      setMessage('Failed to update ads per newsletter. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingAdsPerNewsletter(false)
    }
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        if (data.max_top_articles) {
          setMaxTopArticles(parseInt(data.max_top_articles))
        }
        if (data.max_bottom_articles) {
          setMaxBottomArticles(parseInt(data.max_bottom_articles))
        }
      }
    } catch (error) {
      console.error('Failed to load max articles settings:', error)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) {
      alert('Max primary articles must be between 1 and 10')
      return
    }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) {
      alert('Max secondary articles must be between 1 and 10')
      return
    }

    setSavingMaxArticles(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_top_articles: maxTopArticles.toString(),
          max_bottom_articles: maxBottomArticles.toString()
        })
      })

      if (response.ok) {
        setMessage('Max articles settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const handleEdit = (tier: any) => {
    setEditingId(tier.id)
    setEditPrice(tier.price_per_unit.toString())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditPrice('')
  }

  const handleSaveEdit = async (tierId: string) => {
    if (!editPrice || isNaN(parseFloat(editPrice))) {
      alert('Please enter a valid price')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ad-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tierId,
          price_per_unit: parseFloat(editPrice)
        })
      })

      if (response.ok) {
        setMessage('Price updated successfully!')
        setTimeout(() => setMessage(''), 3000)
        setEditingId(null)
        setEditPrice('')
        loadTiers()
      } else {
        throw new Error('Failed to update price')
      }
    } catch (error) {
      setMessage('Failed to update price. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const tiersByFrequency = useMemo(() => ({
    single: tiers.filter(t => t.frequency === 'single'),
    weekly: tiers.filter(t => t.frequency === 'weekly'),
    monthly: tiers.filter(t => t.frequency === 'monthly')
  }), [tiers])

  return {
    loading,
    saving,
    message,
    editingId,
    editPrice,
    setEditPrice,
    adsPerNewsletter,
    setAdsPerNewsletter,
    savingAdsPerNewsletter,
    maxTopArticles,
    setMaxTopArticles,
    maxBottomArticles,
    setMaxBottomArticles,
    savingMaxArticles,
    tiersByFrequency,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    saveAdsPerNewsletter,
    saveMaxArticles,
  }
}

export function getFrequencyLabel(frequency: string) {
  switch (frequency) {
    case 'single': return 'Single Appearance'
    case 'weekly': return 'Weekly'
    case 'monthly': return 'Monthly'
    default: return frequency
  }
}

export function getQuantityLabel(tier: any) {
  if (tier.max_quantity === null) {
    return `${tier.min_quantity}+`
  }
  return `${tier.min_quantity}-${tier.max_quantity}`
}
