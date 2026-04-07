'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import type { NewsletterSection, AdModule, PollModule, AIAppModule, PromptModule, ArticleModule, TextBoxModule, FeedbackModuleWithBlocks, FeedbackBlock, SparkLoopRecModule } from '@/types/database'
import type { SectionItem, NewSectionType } from './types'
import { getItemId } from './types'

// Section IDs that are now handled by modules (exclude from sections list)
const EXCLUDED_SECTION_IDS = [
  'c0bc7173-de47-41b2-a260-77f55525ee3d', // Advertisement - handled by AdModulesPanel
  '853f8d0b-bc76-473a-bfc6-421418266222'  // AI Applications - handled by AIAppModulesPanel
]

// Section types that are now handled by other modules (exclude from sections list)
const EXCLUDED_SECTION_TYPES = [
  'primary_articles',   // Now handled by article_modules
  'secondary_articles', // Now handled by article_modules
  'welcome'             // Now handled by text_box_modules
]

// Generic helper for standard module update/delete patterns (ID in URL path)
function makeModuleHandlers<T extends { id: string }>(
  apiPath: string,
  type: SectionItem['type'],
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  selectedItem: SectionItem | null,
  setSelectedItem: React.Dispatch<React.SetStateAction<SectionItem | null>>
) {
  return {
    update: async (updates: Partial<T>) => {
      if (!selectedItem || selectedItem.type !== type) {
        throw new Error(`No ${type} selected`)
      }
      const moduleId = selectedItem.data.id
      console.log(`[SectionsPanel] Updating ${type}:`, moduleId, updates)

      const res = await fetch(`${apiPath}/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (res.ok) {
        const data = await res.json()
        console.log(`[SectionsPanel] ${type} updated successfully:`, data.module)
        setter(prev => prev.map(m => m.id === moduleId ? data.module : m))
        setSelectedItem({ type, data: data.module } as SectionItem)
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error(`[SectionsPanel] Failed to update ${type}:`, res.status, errorData)
        throw new Error(errorData.error || `Failed to update ${type} (${res.status})`)
      }
    },
    delete: async () => {
      if (!selectedItem || selectedItem.type !== type) return
      const moduleId = selectedItem.data.id
      const res = await fetch(`${apiPath}/${moduleId}`, { method: 'DELETE' })
      if (res.ok) {
        setter(prev => prev.filter(m => m.id !== moduleId))
        setSelectedItem(null)
      }
    }
  }
}

export default function useSectionsPanel(propPublicationId?: string) {
  const pathname = usePathname()
  const [publicationId, setPublicationId] = useState<string | null>(propPublicationId || null)
  const [sections, setSections] = useState<NewsletterSection[]>([])
  const [adModules, setAdModules] = useState<AdModule[]>([])
  const [pollModules, setPollModules] = useState<PollModule[]>([])
  const [aiAppModules, setAIAppModules] = useState<AIAppModule[]>([])
  const [promptModules, setPromptModules] = useState<PromptModule[]>([])
  const [articleModules, setArticleModules] = useState<ArticleModule[]>([])
  const [textBoxModules, setTextBoxModules] = useState<TextBoxModule[]>([])
  const [feedbackModules, setFeedbackModules] = useState<FeedbackModuleWithBlocks[]>([])
  const [sparkloopRecModules, setSparkloopRecModules] = useState<SparkLoopRecModule[]>([])
  const [selectedItem, setSelectedItem] = useState<SectionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cooldownDays, setCooldownDays] = useState(7)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [newSectionType, setNewSectionType] = useState<NewSectionType>('ad')

  // Fetch publication ID from slug if not provided
  useEffect(() => {
    if (propPublicationId) {
      setPublicationId(propPublicationId)
      return
    }

    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetchPublicationId(slug)
      }
    }
  }, [pathname, propPublicationId])

  const fetchPublicationId = async (slug: string) => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch publications')
      const data = await response.json()
      const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
      if (publication) {
        setPublicationId(publication.id)
      } else {
        console.error('[SectionsPanel] Publication not found for slug:', slug)
        setLoading(false)
      }
    } catch (error) {
      console.error('[SectionsPanel] Error fetching publication:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (publicationId) {
      fetchData()
    }
  }, [publicationId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch newsletter sections
      const sectionsRes = await fetch(`/api/settings/newsletter-sections?publication_id=${publicationId}`)
      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json()
        setSections(sectionsData.sections || [])
      }

      // Fetch ad modules
      const adModulesRes = await fetch(`/api/ad-modules?publication_id=${publicationId}`)
      if (adModulesRes.ok) {
        const adModulesData = await adModulesRes.json()
        setAdModules(adModulesData.modules || [])
      }

      // Fetch poll modules
      const pollModulesRes = await fetch(`/api/poll-modules?publication_id=${publicationId}`)
      if (pollModulesRes.ok) {
        const pollModulesData = await pollModulesRes.json()
        setPollModules(pollModulesData.modules || [])
      }

      // Fetch AI app modules
      const aiAppModulesRes = await fetch(`/api/ai-app-modules?publication_id=${publicationId}`)
      if (aiAppModulesRes.ok) {
        const aiAppModulesData = await aiAppModulesRes.json()
        setAIAppModules(aiAppModulesData.modules || [])
      }

      // Fetch prompt modules
      const promptModulesRes = await fetch(`/api/prompt-modules?publication_id=${publicationId}`)
      if (promptModulesRes.ok) {
        const promptModulesData = await promptModulesRes.json()
        setPromptModules(promptModulesData.modules || [])
      }

      // Fetch article modules
      const articleModulesRes = await fetch(`/api/article-modules?publication_id=${publicationId}`)
      if (articleModulesRes.ok) {
        const articleModulesData = await articleModulesRes.json()
        setArticleModules(articleModulesData.modules || [])
      }

      // Fetch text box modules
      const textBoxModulesRes = await fetch(`/api/text-box-modules?publication_id=${publicationId}`)
      if (textBoxModulesRes.ok) {
        const textBoxModulesData = await textBoxModulesRes.json()
        setTextBoxModules(textBoxModulesData.modules || [])
      }

      // Fetch sparkloop rec modules
      const sparkloopRecModulesRes = await fetch(`/api/sparkloop-rec-modules?publication_id=${publicationId}`)
      if (sparkloopRecModulesRes.ok) {
        const sparkloopRecModulesData = await sparkloopRecModulesRes.json()
        setSparkloopRecModules(sparkloopRecModulesData.modules || [])
      }

      // Fetch feedback modules (singleton - at most one per publication)
      const feedbackModulesRes = await fetch(`/api/feedback-modules?publication_id=${publicationId}`)
      if (feedbackModulesRes.ok) {
        const feedbackModulesData = await feedbackModulesRes.json()
        // Wrap single module in array if it exists
        if (feedbackModulesData.module) {
          setFeedbackModules([feedbackModulesData.module])
        } else {
          setFeedbackModules([])
        }
      }

      // Fetch cooldown setting
      const settingsRes = await fetch(`/api/settings/publication?key=ad_company_cooldown_days&publication_id=${publicationId}`)
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setCooldownDays(parseInt(settingsData.value) || 7)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Combine and sort all items by display_order
  const allItems: SectionItem[] = useMemo(() => [
    ...sections
      .filter(s => !EXCLUDED_SECTION_IDS.includes(s.id) && !EXCLUDED_SECTION_TYPES.includes(s.section_type || ''))
      .map(s => ({ type: 'section' as const, data: s })),
    ...adModules.map(m => ({ type: 'ad_module' as const, data: m })),
    ...pollModules.map(m => ({ type: 'poll_module' as const, data: m })),
    ...aiAppModules.map(m => ({ type: 'ai_app_module' as const, data: m })),
    ...promptModules.map(m => ({ type: 'prompt_module' as const, data: m })),
    ...articleModules.map(m => ({ type: 'article_module' as const, data: m })),
    ...textBoxModules.map(m => ({ type: 'text_box_module' as const, data: m })),
    ...feedbackModules.map(m => ({ type: 'feedback_module' as const, data: m })),
    ...sparkloopRecModules.map(m => ({ type: 'sparkloop_rec_module' as const, data: m }))
  ].sort((a, b) => {
    const orderA = a.data.display_order ?? 999
    const orderB = b.data.display_order ?? 999
    return orderA - orderB
  }), [sections, adModules, pollModules, aiAppModules, promptModules, articleModules, textBoxModules, feedbackModules, sparkloopRecModules])

  const itemIds = useMemo(() => allItems.map(getItemId), [allItems])

  // Generic module handlers using the helper
  const adHandlers = makeModuleHandlers<AdModule>('/api/ad-modules', 'ad_module', setAdModules, selectedItem, setSelectedItem)
  const pollHandlers = makeModuleHandlers<PollModule>('/api/poll-modules', 'poll_module', setPollModules, selectedItem, setSelectedItem)
  const aiAppHandlers = makeModuleHandlers<AIAppModule>('/api/ai-app-modules', 'ai_app_module', setAIAppModules, selectedItem, setSelectedItem)
  const promptHandlers = makeModuleHandlers<PromptModule>('/api/prompt-modules', 'prompt_module', setPromptModules, selectedItem, setSelectedItem)
  const articleHandlers = makeModuleHandlers<ArticleModule>('/api/article-modules', 'article_module', setArticleModules, selectedItem, setSelectedItem)
  const textBoxHandlers = makeModuleHandlers<TextBoxModule>('/api/text-box-modules', 'text_box_module', setTextBoxModules, selectedItem, setSelectedItem)
  const sparkloopRecHandlers = makeModuleHandlers<SparkLoopRecModule>('/api/sparkloop-rec-modules', 'sparkloop_rec_module', setSparkloopRecModules, selectedItem, setSelectedItem)

  // Drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = itemIds.indexOf(active.id as string)
    const newIndex = itemIds.indexOf(over.id as string)

    if (oldIndex === -1 || newIndex === -1) return

    // Reorder local state - assign display_order based on position in combined list
    const reorderedItems = arrayMove(allItems, oldIndex, newIndex)
    const newSections: NewsletterSection[] = []
    const newAdModules: AdModule[] = []
    const newPollModules: PollModule[] = []
    const newAIAppModules: AIAppModule[] = []
    const newPromptModules: PromptModule[] = []
    const newArticleModules: ArticleModule[] = []
    const newTextBoxModules: TextBoxModule[] = []
    const newFeedbackModules: FeedbackModuleWithBlocks[] = []
    const newSparkloopRecModules: SparkLoopRecModule[] = []

    reorderedItems.forEach((item, idx) => {
      const newOrder = idx + 1
      if (item.type === 'section') {
        newSections.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'ad_module') {
        newAdModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'poll_module') {
        newPollModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'ai_app_module') {
        newAIAppModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'article_module') {
        newArticleModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'text_box_module') {
        newTextBoxModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'feedback_module') {
        newFeedbackModules.push({ ...item.data, display_order: newOrder })
      } else if (item.type === 'sparkloop_rec_module') {
        newSparkloopRecModules.push({ ...item.data, display_order: newOrder })
      } else {
        newPromptModules.push({ ...item.data, display_order: newOrder })
      }
    })

    setSections(newSections)
    setAdModules(newAdModules)
    setPollModules(newPollModules)
    setAIAppModules(newAIAppModules)
    setPromptModules(newPromptModules)
    setArticleModules(newArticleModules)
    setTextBoxModules(newTextBoxModules)
    setFeedbackModules(newFeedbackModules)
    setSparkloopRecModules(newSparkloopRecModules)

    // Save to server
    setSaving(true)
    try {
      const orderUpdates: Array<{ condition: boolean; url: string; body: unknown }> = [
        { condition: newSections.length > 0, url: '/api/settings/newsletter-sections', body: { publication_id: publicationId, sections: newSections.map(s => ({ id: s.id, display_order: s.display_order })) } },
        { condition: newAdModules.length > 0, url: '/api/ad-modules', body: { modules: newAdModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newPollModules.length > 0, url: '/api/poll-modules', body: { modules: newPollModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newAIAppModules.length > 0, url: '/api/ai-app-modules', body: { modules: newAIAppModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newPromptModules.length > 0, url: '/api/prompt-modules', body: { modules: newPromptModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newArticleModules.length > 0, url: '/api/article-modules', body: { modules: newArticleModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newTextBoxModules.length > 0, url: '/api/text-box-modules', body: { modules: newTextBoxModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newFeedbackModules.length > 0, url: '/api/feedback-modules', body: { modules: newFeedbackModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
        { condition: newSparkloopRecModules.length > 0, url: '/api/sparkloop-rec-modules', body: { modules: newSparkloopRecModules.map(m => ({ id: m.id, display_order: m.display_order })) } },
      ]

      await Promise.all(
        orderUpdates
          .filter(u => u.condition)
          .map(u => fetch(u.url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u.body)
          }))
      )
    } catch (error) {
      console.error('Failed to save order:', error)
      // Revert on error
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  // Toggle handler
  const handleToggleSection = async (item: SectionItem) => {
    const newActive = !item.data.is_active
    setSaving(true)

    try {
      if (item.type === 'section') {
        await fetch('/api/settings/newsletter-sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            section_id: item.data.id,
            is_active: newActive
          })
        })
        setSections(prev => prev.map(s =>
          s.id === item.data.id ? { ...s, is_active: newActive } : s
        ))
      } else if (item.type === 'feedback_module') {
        // Feedback module uses body-based ID, not URL path
        await fetch(`/api/feedback-modules`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.data.id, is_active: newActive })
        })
        setFeedbackModules(prev => prev.map(m =>
          m.id === item.data.id ? { ...m, is_active: newActive } : m
        ))
      } else {
        // All other module types use /api/{type}/{id} pattern
        const apiPaths: Record<string, string> = {
          ad_module: '/api/ad-modules',
          poll_module: '/api/poll-modules',
          ai_app_module: '/api/ai-app-modules',
          prompt_module: '/api/prompt-modules',
          article_module: '/api/article-modules',
          text_box_module: '/api/text-box-modules',
          sparkloop_rec_module: '/api/sparkloop-rec-modules',
        }
        const apiPath = apiPaths[item.type]
        if (apiPath) {
          await fetch(`${apiPath}/${item.data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newActive })
          })
        }

        // Update the correct setter
        const setterMap: Record<string, React.Dispatch<React.SetStateAction<Array<{ id: string; is_active: boolean } & Record<string, unknown>>>>> = {
          ad_module: setAdModules as never,
          poll_module: setPollModules as never,
          ai_app_module: setAIAppModules as never,
          prompt_module: setPromptModules as never,
          article_module: setArticleModules as never,
          text_box_module: setTextBoxModules as never,
          sparkloop_rec_module: setSparkloopRecModules as never,
        }
        const setter = setterMap[item.type]
        if (setter) {
          setter(prev => prev.map(m =>
            m.id === item.data.id ? { ...m, is_active: newActive } : m
          ))
        }
      }

      // Update selected item if it's the one being toggled
      if (selectedItem && selectedItem.data.id === item.data.id && selectedItem.type === item.type) {
        setSelectedItem({
          ...item,
          data: { ...item.data, is_active: newActive }
        } as SectionItem)
      }
    } catch (error) {
      console.error('Failed to toggle:', error)
    } finally {
      setSaving(false)
    }
  }

  // Add section handler
  const handleAddSection = async () => {
    if (!newModuleName.trim() || !publicationId) return

    setSaving(true)
    try {
      const moduleConfigs: Record<string, { url: string; type: SectionItem['type']; setter: (data: { module: never }) => void }> = {
        ad: { url: '/api/ad-modules', type: 'ad_module', setter: (data) => { setAdModules(prev => [...prev, data.module]); setSelectedItem({ type: 'ad_module', data: data.module }) } },
        poll: { url: '/api/poll-modules', type: 'poll_module', setter: (data) => { setPollModules(prev => [...prev, data.module]); setSelectedItem({ type: 'poll_module', data: data.module }) } },
        ai_app: { url: '/api/ai-app-modules', type: 'ai_app_module', setter: (data) => { setAIAppModules(prev => [...prev, data.module]); setSelectedItem({ type: 'ai_app_module', data: data.module }) } },
        prompt: { url: '/api/prompt-modules', type: 'prompt_module', setter: (data) => { setPromptModules(prev => [...prev, data.module]); setSelectedItem({ type: 'prompt_module', data: data.module }) } },
        article: { url: '/api/article-modules', type: 'article_module', setter: (data) => { setArticleModules(prev => [...prev, data.module]); setSelectedItem({ type: 'article_module', data: data.module }) } },
        text_box: { url: '/api/text-box-modules', type: 'text_box_module', setter: (data) => { setTextBoxModules(prev => [...prev, data.module]); setSelectedItem({ type: 'text_box_module', data: data.module }) } },
        sparkloop_rec: { url: '/api/sparkloop-rec-modules', type: 'sparkloop_rec_module', setter: (data) => { setSparkloopRecModules(prev => [...prev, data.module]); setSelectedItem({ type: 'sparkloop_rec_module', data: data.module }) } },
      }

      const config = moduleConfigs[newSectionType]

      if (config) {
        const res = await fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: newModuleName.trim()
          })
        })
        if (res.ok) {
          const data = await res.json()
          config.setter(data)
        }
      } else if (newSectionType === 'feedback') {
        // Feedback module (singleton - POST creates or returns existing)
        const res = await fetch('/api/feedback-modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: newModuleName.trim()
          })
        })
        if (res.ok) {
          const data = await res.json()
          setFeedbackModules([data.module])
          setSelectedItem({ type: 'feedback_module', data: data.module })
        }
      } else {
        // Create standard section
        const res = await fetch('/api/settings/newsletter-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: newModuleName.trim(),
            display_order: allItems.length + 1,
            is_active: true
          })
        })
        if (res.ok) {
          const data = await res.json()
          setSections(prev => [...prev, data.section])
          setSelectedItem({ type: 'section', data: data.section })
        }
      }

      setShowAddModal(false)
      setNewModuleName('')
      setNewSectionType('ad')
    } catch (error) {
      console.error('Failed to add section:', error)
    } finally {
      setSaving(false)
    }
  }

  // Feedback module handlers (different API pattern - no ID in URL)
  const handleUpdateFeedbackModule = async (updates: Partial<FeedbackModuleWithBlocks>) => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') {
      throw new Error('No feedback module selected')
    }

    const moduleId = selectedItem.data.id
    console.log('[SectionsPanel] Updating feedback module:', moduleId, updates)

    const res = await fetch(`/api/feedback-modules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: moduleId, ...updates })
    })

    if (res.ok) {
      const data = await res.json()
      console.log('[SectionsPanel] Feedback module updated successfully:', data.module)
      setFeedbackModules(prev => prev.map(m => m.id === moduleId ? data.module : m))
      setSelectedItem({ type: 'feedback_module', data: data.module })
    } else {
      const errorData = await res.json().catch(() => ({}))
      console.error('[SectionsPanel] Failed to update feedback module:', res.status, errorData)
      throw new Error(errorData.error || `Failed to update feedback module (${res.status})`)
    }
  }

  const handleUpdateFeedbackBlock = async (blockId: string, updates: Partial<FeedbackBlock>) => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') {
      throw new Error('No feedback module selected')
    }

    console.log('[SectionsPanel] Updating feedback block:', blockId, updates)

    const res = await fetch(`/api/feedback-modules/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (res.ok) {
      const data = await res.json()
      console.log('[SectionsPanel] Feedback block updated successfully:', data.block)
      // Update the block in the module's blocks array
      setFeedbackModules(prev => prev.map(m => {
        if (m.id === selectedItem.data.id) {
          return {
            ...m,
            blocks: m.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
          }
        }
        return m
      }))
      // Update selected item as well
      setSelectedItem({
        type: 'feedback_module',
        data: {
          ...selectedItem.data,
          blocks: (selectedItem.data as FeedbackModuleWithBlocks).blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
        }
      })
    } else {
      const errorData = await res.json().catch(() => ({}))
      console.error('[SectionsPanel] Failed to update feedback block:', res.status, errorData)
      throw new Error(errorData.error || `Failed to update feedback block (${res.status})`)
    }
  }

  const handleReorderFeedbackBlocks = async (blockIds: string[]) => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') {
      throw new Error('No feedback module selected')
    }

    const moduleId = selectedItem.data.id
    console.log('[SectionsPanel] Reordering feedback blocks:', moduleId, blockIds)

    const res = await fetch(`/api/feedback-modules/blocks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_id: moduleId, block_ids: blockIds })
    })

    if (res.ok) {
      console.log('[SectionsPanel] Feedback blocks reordered successfully')
      const feedbackData = selectedItem.data as FeedbackModuleWithBlocks
      const reorderedBlocks = blockIds.map((id, idx) => {
        const block = feedbackData.blocks.find(b => b.id === id)
        return block ? { ...block, display_order: idx } : null
      }).filter(Boolean) as FeedbackBlock[]

      setFeedbackModules(prev => prev.map(m => {
        if (m.id === moduleId) {
          return { ...m, blocks: reorderedBlocks }
        }
        return m
      }))
      setSelectedItem({
        type: 'feedback_module',
        data: { ...selectedItem.data, blocks: reorderedBlocks }
      })
    } else {
      const errorData = await res.json().catch(() => ({}))
      console.error('[SectionsPanel] Failed to reorder feedback blocks:', res.status, errorData)
      throw new Error(errorData.error || `Failed to reorder feedback blocks (${res.status})`)
    }
  }

  const handleAddFeedbackBlock = async (blockType: FeedbackBlock['block_type']) => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') {
      throw new Error('No feedback module selected')
    }

    const moduleId = selectedItem.data.id
    console.log('[SectionsPanel] Adding feedback block:', moduleId, blockType)

    const res = await fetch(`/api/feedback-modules/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_id: moduleId, block_type: blockType })
    })

    if (res.ok) {
      const data = await res.json()
      console.log('[SectionsPanel] Feedback block added successfully:', data.block)
      const feedbackData = selectedItem.data as FeedbackModuleWithBlocks
      const updatedBlocks = [...feedbackData.blocks, data.block]

      setFeedbackModules(prev => prev.map(m => {
        if (m.id === moduleId) {
          return { ...m, blocks: updatedBlocks }
        }
        return m
      }))
      setSelectedItem({
        type: 'feedback_module',
        data: { ...selectedItem.data, blocks: updatedBlocks }
      })
    } else {
      const errorData = await res.json().catch(() => ({}))
      console.error('[SectionsPanel] Failed to add feedback block:', res.status, errorData)
      throw new Error(errorData.error || `Failed to add feedback block (${res.status})`)
    }
  }

  const handleDeleteFeedbackBlock = async (blockId: string) => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') {
      throw new Error('No feedback module selected')
    }

    const moduleId = selectedItem.data.id
    console.log('[SectionsPanel] Deleting feedback block:', blockId)

    const res = await fetch(`/api/feedback-modules/blocks/${blockId}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      console.log('[SectionsPanel] Feedback block deleted successfully')
      const feedbackData = selectedItem.data as FeedbackModuleWithBlocks
      const updatedBlocks = feedbackData.blocks.filter(b => b.id !== blockId)

      setFeedbackModules(prev => prev.map(m => {
        if (m.id === moduleId) {
          return { ...m, blocks: updatedBlocks }
        }
        return m
      }))
      setSelectedItem({
        type: 'feedback_module',
        data: { ...selectedItem.data, blocks: updatedBlocks }
      })
    } else {
      const errorData = await res.json().catch(() => ({}))
      console.error('[SectionsPanel] Failed to delete feedback block:', res.status, errorData)
      throw new Error(errorData.error || `Failed to delete feedback block (${res.status})`)
    }
  }

  const handleDeleteFeedbackModule = async () => {
    if (!selectedItem || selectedItem.type !== 'feedback_module') return

    const moduleId = selectedItem.data.id
    const res = await fetch(`/api/feedback-modules?id=${moduleId}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      setFeedbackModules([])
      setSelectedItem(null)
    }
  }

  // Cooldown handler
  const handleCooldownChange = async (days: number) => {
    try {
      await fetch(`/api/settings/publication?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ad_company_cooldown_days',
          value: days.toString()
        })
      })
      setCooldownDays(days)
    } catch (error) {
      console.error('Failed to update cooldown:', error)
    }
  }

  // Section update handler
  const handleUpdateSection = async (updates: Partial<NewsletterSection>) => {
    if (!selectedItem || selectedItem.type !== 'section') return

    const sectionId = selectedItem.data.id
    setSaving(true)
    try {
      const res = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          section_id: sectionId,
          ...updates
        })
      })

      if (res.ok) {
        // Update local state
        setSections(prev => prev.map(s =>
          s.id === sectionId ? { ...s, ...updates } : s
        ))
        setSelectedItem({
          type: 'section',
          data: { ...selectedItem.data, ...updates } as NewsletterSection
        })
      } else {
        throw new Error('Failed to update section')
      }
    } catch (error) {
      console.error('Failed to update section:', error)
    } finally {
      setSaving(false)
    }
  }

  return {
    // State
    publicationId,
    loading,
    saving,
    selectedItem,
    setSelectedItem,
    allItems,
    itemIds,
    cooldownDays,
    showAddModal,
    setShowAddModal,
    newModuleName,
    setNewModuleName,
    newSectionType,
    setNewSectionType,
    feedbackModules,

    // Handlers
    handleDragEnd,
    handleToggleSection,
    handleAddSection,
    handleUpdateModule: adHandlers.update,
    handleDeleteModule: adHandlers.delete,
    handleUpdatePollModule: pollHandlers.update,
    handleDeletePollModule: pollHandlers.delete,
    handleUpdateAIAppModule: aiAppHandlers.update,
    handleDeleteAIAppModule: aiAppHandlers.delete,
    handleUpdatePromptModule: promptHandlers.update,
    handleDeletePromptModule: promptHandlers.delete,
    handleUpdateArticleModule: articleHandlers.update,
    handleDeleteArticleModule: articleHandlers.delete,
    handleUpdateTextBoxModule: textBoxHandlers.update,
    handleDeleteTextBoxModule: textBoxHandlers.delete,
    handleUpdateFeedbackModule,
    handleUpdateFeedbackBlock,
    handleReorderFeedbackBlocks,
    handleAddFeedbackBlock,
    handleDeleteFeedbackBlock,
    handleDeleteFeedbackModule,
    handleUpdateSparkLoopRecModule: sparkloopRecHandlers.update,
    handleDeleteSparkLoopRecModule: sparkloopRecHandlers.delete,
    handleCooldownChange,
    handleUpdateSection,
  }
}
