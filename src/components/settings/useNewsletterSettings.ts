'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import type { NewsletterSection } from '@/types/database'
import { useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

export function useNewsletterSettings() {
  const pathname = usePathname()
  const [sections, setSections] = useState<NewsletterSection[]>([])
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [message, setMessage] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch publication ID from slug
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetch('/api/newsletters')
          .then(res => res.json())
          .then(data => {
            const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
            if (publication) {
              setPublicationId(publication.id)
            }
          })
          .catch(console.error)
      }
    }
  }, [pathname])

  useEffect(() => {
    if (publicationId) {
      fetchSections()
    }
  }, [publicationId])

  const fetchSections = async () => {
    try {
      const response = await fetch(`/api/settings/newsletter-sections?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSectionOrder = async (updatedSections: NewsletterSection[]) => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          sections: updatedSections.map(s => ({
            id: s.id,
            display_order: s.display_order
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save section order')
      }

      setMessage('Section order updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex(section => section.id === active.id)
      const newIndex = sections.findIndex(section => section.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = arrayMove(sections, oldIndex, newIndex)
        const updatedSections = newSections.map((section, index) => ({
          ...section,
          display_order: index + 1
        }))

        setSections(updatedSections)

        try {
          await saveSectionOrder(updatedSections)
        } catch (error) {
          setSections(sections)
          setMessage('Failed to update section order. Please try again.')
        }
      }
    }
  }

  const runMigration = async () => {
    setMigrating(true)
    setMessage('')

    try {
      const response = await fetch('/api/debug/migrate-newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setMessage(`Migration successful! ${data.message}`)
        await fetchSections()
      } else {
        const errorData = await response.json()
        setMessage(`Migration failed: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      setMessage('Migration failed: Network error. Please try again.')
      console.error('Migration error:', error)
    } finally {
      setMigrating(false)
      setTimeout(() => setMessage(''), 5000)
    }
  }

  const toggleSection = async (sectionId: string, isActive: boolean) => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          section_id: sectionId,
          is_active: isActive
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update section status')
      }

      setSections(prev => prev.map(section =>
        section.id === sectionId
          ? { ...section, is_active: isActive }
          : section
      ))

      setMessage(`Section ${isActive ? 'activated' : 'deactivated'} successfully!`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to update section status. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditName = async (sectionId: string, newName: string) => {
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          section_id: sectionId,
          name: newName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update section name')
      }

      setSections(prev => prev.map(section =>
        section.id === sectionId
          ? { ...section, name: newName }
          : section
      ))

      setMessage('Section name updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to update section name. Please try again.')
      throw error
    }
  }

  return {
    sections,
    publicationId,
    loading,
    saving,
    migrating,
    message,
    sensors,
    handleDragEnd,
    runMigration,
    toggleSection,
    handleEditName,
  }
}
