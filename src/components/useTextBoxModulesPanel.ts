'use client'

import { useState, useEffect } from 'react'
import type {
  TextBoxModule,
  TextBoxBlock,
  IssueTextBoxBlock,
} from '@/types/database'

export interface TextBoxSelection {
  module: TextBoxModule
  blocks: TextBoxBlock[]
  issueBlocks: IssueTextBoxBlock[]
}

export function useTextBoxModulesPanel(issueId: string) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<TextBoxSelection[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchTextBoxModules()
  }, [issueId])

  // Auto-expand modules that have AI-generated content
  useEffect(() => {
    if (selections.length > 0) {
      const autoExpand: Record<string, boolean> = {}
      selections.forEach(selection => {
        const hasAIContent = selection.blocks.some(block => {
          if (block.block_type === 'ai_prompt' && block.is_active) {
            const issueBlock = selection.issueBlocks.find(ib => ib.text_box_block_id === block.id)
            return issueBlock?.generated_content || issueBlock?.override_content
          }
          return false
        })
        if (hasAIContent) {
          autoExpand[selection.module.id] = true
        }
      })
      if (Object.keys(autoExpand).length > 0) {
        setExpanded(prev => {
          const hasExisting = Object.keys(prev).length > 0
          return hasExisting ? prev : autoExpand
        })
      }
    }
  }, [selections])

  const fetchTextBoxModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`)
      if (response.ok) {
        const data = await response.json()
        console.log('[TextBoxModulesPanel] Fetched data:', {
          modulesCount: data.modules?.length,
          modules: data.modules?.map((s: any) => ({
            name: s.module?.name,
            blocksCount: s.blocks?.length,
            issueBlocksCount: s.issueBlocks?.length,
            aiPromptBlocks: s.blocks?.filter((b: any) => b.block_type === 'ai_prompt').map((b: any) => ({
              id: b.id,
              is_active: b.is_active,
              issueBlock: s.issueBlocks?.find((ib: any) => ib.text_box_block_id === b.id)
            }))
          }))
        })
        setSelections(data.modules || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[TextBoxModulesPanel] API error:', response.status, errorData)
      }
    } catch (error) {
      console.error('Failed to fetch text box modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async (blockId: string) => {
    setRegenerating(blockId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', blockId })
      })

      if (response.ok) {
        await fetchTextBoxModules()
      } else {
        const error = await response.json()
        alert(`Failed to regenerate: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to regenerate:', error)
      alert('Failed to regenerate content')
    } finally {
      setRegenerating(null)
    }
  }

  const handleSaveOverride = async (blockId: string, content: string) => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, overrideContent: content || null })
      })

      if (response.ok) {
        await fetchTextBoxModules()
        setEditingContent(prev => {
          const updated = { ...prev }
          delete updated[blockId]
          return updated
        })
      } else {
        const error = await response.json()
        alert(`Failed to save: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save override:', error)
      alert('Failed to save override')
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  return {
    loading,
    selections,
    expanded,
    regenerating,
    editingContent,
    setEditingContent,
    handleRegenerate,
    handleSaveOverride,
    toggleExpanded,
  }
}

export function getBlockContent(block: TextBoxBlock, issueBlock?: IssueTextBoxBlock): string {
  if (issueBlock?.override_content) return issueBlock.override_content
  if (block.block_type === 'static_text') return block.static_content || ''
  if (block.block_type === 'ai_prompt') return issueBlock?.generated_content || ''
  return ''
}

export function getBlockImage(block: TextBoxBlock, issueBlock?: IssueTextBoxBlock): string {
  if (issueBlock?.override_image_url) return issueBlock.override_image_url
  if (block.image_type === 'static') return block.static_image_url || ''
  return issueBlock?.generated_image_url || ''
}

export function getStatusBadge(status?: string) {
  switch (status) {
    case 'completed':
      return 'Generated'
    case 'pending':
      return 'Pending'
    case 'generating':
      return 'Generating...'
    case 'failed':
      return 'Failed'
    case 'manual':
      return 'Manual Override'
    default:
      return null
  }
}

export const STATUS_BADGE_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  generating: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  manual: 'bg-purple-100 text-purple-700',
}
