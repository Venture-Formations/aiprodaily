'use client'

import { useState, useEffect } from 'react'

interface AdModule {
  id: string
  name: string
  display_order: number
  block_order: string[]
  selection_mode: string
  is_active: boolean
}

interface ModuleAd {
  id: string
  title: string
  body?: string
  image_url?: string
  button_text?: string
  button_url?: string
  cta_text?: string | null
  times_used?: number
  display_order?: number
  advertiser?: {
    id: string
    company_name: string
    logo_url?: string
  }
}

interface AdSelection {
  id: string
  selection_mode: string
  selected_at?: string
  used_at?: string
  ad_module?: AdModule
  advertisement?: ModuleAd
}

export type { AdModule, ModuleAd, AdSelection }

export function useAdModulesPanel(issueId: string) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<AdSelection[]>([])
  const [modules, setModules] = useState<AdModule[]>([])
  const [moduleAds, setModuleAds] = useState<Record<string, ModuleAd[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchAdModules()
  }, [issueId])

  const fetchAdModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/ad-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setModuleAds(data.moduleAds || {})
      }
    } catch (error) {
      console.error('Failed to fetch ad modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAd = async (moduleId: string, adId: string) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/ad-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, adId })
      })
      if (response.ok) {
        await fetchAdModules()
      } else {
        const error = await response.json()
        alert(`Failed to select ad: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to select ad:', error)
      alert('Failed to select ad')
    } finally {
      setSaving(null)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  const getSelectionForModule = (moduleId: string) => {
    return selections.find(s => s.ad_module?.id === moduleId)
  }

  return {
    loading, modules, moduleAds, expanded, saving,
    handleSelectAd, toggleExpanded, getSelectionForModule,
  }
}
