'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePublicationId } from '@/hooks/usePublicationId'

export interface ArticleImage {
  id: string
  publication_id: string
  category: string
  lookup_key: string
  display_name: string
  image_url: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MemberSuggestion {
  name: string
  party: string
  state: string
  chamber: string
}

export const TRANSACTION_TYPES = ['Purchase', 'Sale']

export function normalizeLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildDisplayName(member: string, transaction: string): string {
  return `${member} - ${transaction}`
}

export function buildLookupKey(member: string, transaction: string): string {
  return normalizeLookupKey(`${member} ${transaction}`)
}

export function useArticleImages() {
  const { publicationId } = usePublicationId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [images, setImages] = useState<ArticleImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingImage, setEditingImage] = useState<ArticleImage | null>(null)
  const [filterMember, setFilterMember] = useState('')
  const [filterTransaction, setFilterTransaction] = useState('')

  // Add form state
  const [memberName, setMemberName] = useState('')
  const [transactionType, setTransactionType] = useState('Purchase')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allMembers, setAllMembers] = useState<MemberSuggestion[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch('/api/article-images/members')
        const data = await res.json()
        setAllMembers(data.members || [])
        setMembersLoaded(true)
      } catch (err) {
        console.error('Failed to load members:', err)
      }
    }
    loadMembers()
  }, [])

  const updateSuggestions = useCallback((query: string) => {
    if (query.length < 2 || !membersLoaded) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const q = query.toLowerCase()
    const filtered = allMembers
      .filter(m => m.name.toLowerCase().includes(q))
      .slice(0, 10)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }, [allMembers, membersLoaded])

  const handleMemberInput = (value: string) => {
    setMemberName(value)
    updateSuggestions(value)
  }

  const selectSuggestion = (member: MemberSuggestion) => {
    setMemberName(member.name)
    setShowSuggestions(false)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchImages = async () => {
    if (!publicationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/article-images?publication_id=${publicationId}&category=trade`)
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [publicationId])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const fileName = `article-images/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
      const res = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.url) {
        setImageUrl(data.url)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!publicationId || !memberName || !transactionType || !imageUrl) return
    setSaving(true)
    try {
      const displayName = buildDisplayName(memberName, transactionType)
      const lookupKey = buildLookupKey(memberName, transactionType)
      const metadata: Record<string, string> = { member: memberName, transaction: transactionType }

      if (editingImage) {
        const res = await fetch(`/api/article-images/${editingImage.id}?publication_id=${publicationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName,
            image_url: imageUrl,
            lookup_key: lookupKey,
            metadata,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Update failed')
          return
        }
      } else {
        const res = await fetch('/api/article-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            category: 'trade',
            lookup_key: lookupKey,
            display_name: displayName,
            image_url: imageUrl,
            metadata,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Create failed')
          return
        }
      }
      resetForm()
      fetchImages()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image?')) return
    try {
      const res = await fetch(`/api/article-images/${id}?publication_id=${publicationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Delete failed:', res.status, data.error || res.statusText)
        return
      }
      fetchImages()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const resetForm = () => {
    setShowAddModal(false)
    setEditingImage(null)
    setMemberName('')
    setTransactionType('Purchase')
    setImageUrl('')
    setShowSuggestions(false)
  }

  const openEdit = (img: ArticleImage) => {
    setEditingImage(img)
    const meta = img.metadata as Record<string, string>
    setMemberName(meta?.member || img.display_name.split(' - ')[0] || '')
    setTransactionType(meta?.transaction || img.display_name.split(' - ')[1] || 'Purchase')
    setImageUrl(img.image_url)
    setShowAddModal(true)
  }

  const uniqueMembers = Array.from(new Set(images.map(img => (img.metadata as any)?.member).filter(Boolean))).sort() as string[]
  const uniqueTransactions = Array.from(new Set(images.map(img => (img.metadata as any)?.transaction).filter(Boolean))).sort() as string[]

  const filteredImages = images.filter(img => {
    const meta = img.metadata as Record<string, string>
    if (filterMember && meta?.member !== filterMember) return false
    if (filterTransaction && meta?.transaction !== filterTransaction) return false
    return true
  })

  return {
    publicationId,
    fileInputRef,
    suggestionsRef,
    images,
    loading,
    showAddModal,
    setShowAddModal,
    editingImage,
    filterMember,
    setFilterMember,
    filterTransaction,
    setFilterTransaction,
    memberName,
    transactionType,
    setTransactionType,
    imageUrl,
    setImageUrl,
    uploading,
    saving,
    suggestions,
    showSuggestions,
    handleMemberInput,
    selectSuggestion,
    updateSuggestions,
    handleFileUpload,
    handleSave,
    handleDelete,
    resetForm,
    openEdit,
    uniqueMembers,
    uniqueTransactions,
    filteredImages,
  }
}
