'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import type { AIApplication, AIAppModule } from '@/types/database'
import { EMPTY_ADD_FORM } from './types'
import type { UseAIAppsDatabaseReturn } from './types'

export function useAIAppsDatabase(): UseAIAppsDatabaseReturn {
  const params = useParams()
  const slug = params?.slug as string || ''
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [apps, setApps] = useState<AIApplication[]>([])
  const [modules, setModules] = useState<AIAppModule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AIApplication>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<AIApplication>>({ ...EMPTY_ADD_FORM })
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterAffiliate, setFilterAffiliate] = useState<string>('all')
  const [filterModule, setFilterModule] = useState<string>('all')
  const [uploadingCSV, setUploadingCSV] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadModuleId, setUploadModuleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const resolvePublication = async () => {
      try {
        const res = await fetch(`/api/newsletters?slug=${slug}`)
        if (res.ok) {
          const data = await res.json()
          const pub = data.newsletters?.find((n: any) => n.slug === slug)
          if (pub) {
            console.log(`[AI Apps] Resolved slug "${slug}" to publication_id: ${pub.id} (${pub.name})`)
            setPublicationId(pub.id)
          } else {
            console.error(`[AI Apps] No publication found with slug "${slug}". Available:`, data.newsletters?.map((n: any) => n.slug))
            setLoading(false)
          }
        } else {
          console.error('[AI Apps] Failed to fetch newsletters:', res.status)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to resolve publication:', err)
        setLoading(false)
      }
    }
    if (slug) resolvePublication()
  }, [slug])

  useEffect(() => {
    if (publicationId) {
      fetchApps()
      fetchModules()
    }
  }, [publicationId])

  const fetchApps = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ai-apps?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setApps(data.apps || [])
      }
    } catch (error) {
      console.error('Failed to fetch AI applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/ai-app-modules')
      if (response.ok) {
        const data = await response.json()
        setModules(data.modules || [])
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error)
    }
  }

  const handleEdit = (app: AIApplication) => {
    setEditingId(app.id)
    setEditForm({ ...app })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-apps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, publication_id: publicationId })
      })

      if (response.ok) {
        await fetchApps()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Failed to update application:', error)
    }
  }

  const handleDelete = async (id: string, appName: string) => {
    if (!confirm(`Are you sure you want to delete "${appName}"?`)) return

    try {
      const response = await fetch(`/api/ai-apps/${id}?publication_id=${publicationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchApps()
      }
    } catch (error) {
      console.error('Failed to delete application:', error)
    }
  }

  const handleAddApp = async () => {
    if (!addForm.app_name || !addForm.description || !addForm.app_url) {
      alert('Please fill in required fields: App Name, Description, and URL')
      return
    }

    if (!publicationId) {
      alert('Error: Publication not resolved. Cannot create app without publication_id.')
      return
    }

    try {
      console.log(`[AI Apps] Creating app with publication_id: ${publicationId}`)
      const response = await fetch('/api/ai-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, publication_id: publicationId })
      })

      if (response.ok) {
        await fetchApps()
        setShowAddForm(false)
        setAddForm({ ...EMPTY_ADD_FORM })
      } else {
        const errData = await response.json().catch(() => ({}))
        console.error('[AI Apps] POST failed:', response.status, errData)
        alert(`Failed to add application: ${errData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to add application:', error)
    }
  }

  const handleCSVUpload = async (file: File) => {
    setUploadingCSV(true)
    setUploadMessage('')
    setShowUploadModal(false)

    try {
      if (!publicationId) {
        setUploadMessage('Error: publication not resolved. Please reload the page.')
        setUploadingCSV(false)
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('publication_id', publicationId)
      if (uploadModuleId) {
        formData.append('module_id', uploadModuleId)
      }

      const response = await fetch('/api/ai-apps/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.inserted > 0) parts.push(`${data.inserted} added`)
        if (data.updated > 0) parts.push(`${data.updated} updated`)
        const summary = parts.length > 0 ? parts.join(', ') : 'No changes'
        const errorInfo = data.errors ? ` (${data.errors.length} errors)` : ''
        setUploadMessage(`\u2713 Successfully processed: ${summary}${errorInfo}`)
        await fetchApps()
      } else {
        setUploadMessage(`\u2717 Error: ${data.error || 'Upload failed'}`)
      }
    } catch (error) {
      setUploadMessage('\u2717 Error uploading CSV file')
      console.error('Failed to upload CSV:', error)
    } finally {
      setUploadingCSV(false)
      setTimeout(() => setUploadMessage(''), 5000)
    }
  }

  const downloadTemplate = () => {
    const headers = ['Tool Name', 'Category', 'Tool Type', 'Link', 'Description', 'Affiliate']
    const exampleRow = [
      'QuickBooks AI Assistant',
      'Accounting System',
      'Client',
      'https://example.com',
      'AI-powered accounting assistant that categorizes transactions automatically and provides intelligent insights for financial decisions.',
      'yes'
    ]

    const csvContent = [
      headers.join(','),
      exampleRow.map(value => `"${value}"`).join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'ai-apps-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredApps = useMemo(() => apps.filter(app => {
    const matchesCategory = filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !app.category) ||
      app.category === filterCategory
    const matchesAffiliate = filterAffiliate === 'all' ||
      (filterAffiliate === 'affiliates' && app.is_affiliate) ||
      (filterAffiliate === 'non-affiliates' && !app.is_affiliate)
    const matchesModule = filterModule === 'all' ||
      (filterModule === 'unassigned' && !app.ai_app_module_id) ||
      app.ai_app_module_id === filterModule
    const matchesSearch = searchQuery === '' ||
      app.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesAffiliate && matchesModule && matchesSearch
  }), [apps, filterCategory, filterAffiliate, filterModule, searchQuery])

  const getModuleName = (moduleId: string | null) => {
    if (!moduleId) return null
    const mod = modules.find(m => m.id === moduleId)
    return mod?.name || 'Unknown'
  }

  return {
    apps,
    modules,
    filteredApps,
    loading,
    publicationId,
    editingId,
    editForm,
    handleEdit,
    handleCancelEdit,
    handleSave,
    handleDelete,
    setEditForm,
    showAddForm,
    setShowAddForm,
    addForm,
    setAddForm,
    handleAddApp,
    filterCategory,
    setFilterCategory,
    filterAffiliate,
    setFilterAffiliate,
    filterModule,
    setFilterModule,
    searchQuery,
    setSearchQuery,
    uploadingCSV,
    uploadMessage,
    showUploadModal,
    setShowUploadModal,
    uploadModuleId,
    setUploadModuleId,
    handleCSVUpload,
    downloadTemplate,
    getModuleName,
  }
}
