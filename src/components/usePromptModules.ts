'use client'

import { useState, useEffect } from 'react'
import type { PromptModule, PromptIdea, PromptSelectionMode } from '@/types/database'

export interface PromptSelection {
  id: string
  prompt_module_id: string
  prompt_id: string | null
  selection_mode?: PromptSelectionMode
  selected_at?: string
  used_at?: string
  prompt_module?: PromptModule
  prompt?: PromptIdea
}

export interface PublicationStyles {
  primaryColor: string
  tertiaryColor: string
  headingFont: string
  bodyFont: string
}

export function usePromptModules(issueId: string) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<PromptSelection[]>([])
  const [modules, setModules] = useState<PromptModule[]>([])
  const [availablePrompts, setAvailablePrompts] = useState<PromptIdea[]>([])
  const [styles, setStyles] = useState<PublicationStyles>({
    primaryColor: '#667eea',
    tertiaryColor: '#ffffff',
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif'
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchPromptModules()
  }, [issueId])

  const fetchPromptModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/prompt-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setAvailablePrompts(data.availablePrompts || [])
        if (data.styles) {
          setStyles(data.styles)
        }
      }
    } catch (error) {
      console.error('Failed to fetch prompt modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPrompt = async (moduleId: string, promptId: string | null) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/prompt-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, promptId })
      })

      if (response.ok) {
        await fetchPromptModules()
      } else {
        const error = await response.json()
        alert(`Failed to select prompt: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to select prompt:', error)
      alert('Failed to select prompt')
    } finally {
      setSaving(null)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  return {
    loading,
    selections,
    modules,
    availablePrompts,
    styles,
    expanded,
    saving,
    handleSelectPrompt,
    toggleExpanded
  }
}
