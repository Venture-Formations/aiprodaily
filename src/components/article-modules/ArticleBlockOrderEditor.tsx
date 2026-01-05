'use client'

import { useState, type ReactNode } from 'react'
import type { ArticleBlockType } from '@/types/database'

interface ArticleBlockOrderEditorProps {
  blockOrder: ArticleBlockType[]
  onChange: (newOrder: ArticleBlockType[]) => void
  disabled?: boolean
}

const BLOCK_LABELS: Record<ArticleBlockType, string> = {
  source_image: 'Source Image',
  ai_image: 'AI Image',
  title: 'Title',
  body: 'Body'
}

const BLOCK_DESCRIPTIONS: Record<ArticleBlockType, string> = {
  source_image: 'Image from the original article',
  ai_image: 'AI-generated image based on article content',
  title: 'Generated headline for the article',
  body: 'Generated summary/body text'
}

const BLOCK_ICONS: Record<ArticleBlockType, ReactNode> = {
  source_image: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  ai_image: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  title: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
    </svg>
  ),
  body: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default function ArticleBlockOrderEditor({
  blockOrder,
  onChange,
  disabled = false
}: ArticleBlockOrderEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const allBlocks: ArticleBlockType[] = ['source_image', 'ai_image', 'title', 'body']
  const availableBlocks = allBlocks.filter(block => !blockOrder.includes(block))

  const handleDragStart = (index: number) => {
    if (disabled) return
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (disabled || draggedIndex === null || draggedIndex === index) return
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) return

    const newOrder = [...blockOrder]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(dropIndex, 0, removed)

    onChange(newOrder)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleAddBlock = (block: ArticleBlockType) => {
    if (disabled) return
    onChange([...blockOrder, block])
  }

  const handleRemoveBlock = (index: number) => {
    if (disabled) return
    const newOrder = blockOrder.filter((_, i) => i !== index)
    onChange(newOrder)
  }

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (disabled) return
    const newOrder = [...blockOrder]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newOrder.length) return

    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
    onChange(newOrder)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Block Order
        </label>
        <span className="text-xs text-gray-500">Drag to reorder</span>
      </div>

      {/* Active blocks */}
      <div className="space-y-2">
        {blockOrder.map((block, index) => (
          <div
            key={block}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-white border rounded-lg transition-all ${
              disabled ? 'opacity-50' : 'cursor-grab hover:shadow-sm'
            } ${draggedIndex === index ? 'opacity-50 border-emerald-300' : 'border-gray-200'}`}
          >
            {/* Drag handle */}
            <div className="text-gray-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </div>

            {/* Block info */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-emerald-600">{BLOCK_ICONS[block]}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">{BLOCK_LABELS[block]}</p>
                <p className="text-xs text-gray-500">{BLOCK_DESCRIPTIONS[block]}</p>
              </div>
            </div>

            {/* Move buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveBlock(index, 'up')}
                disabled={disabled || index === 0}
                className={`p-1 rounded ${
                  disabled || index === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => moveBlock(index, 'down')}
                disabled={disabled || index === blockOrder.length - 1}
                className={`p-1 rounded ${
                  disabled || index === blockOrder.length - 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Remove button */}
            <button
              onClick={() => handleRemoveBlock(index)}
              disabled={disabled}
              className={`p-1 rounded ${
                disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-red-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Available blocks to add */}
      {availableBlocks.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Add blocks:</p>
          <div className="flex flex-wrap gap-2">
            {availableBlocks.map(block => (
              <button
                key={block}
                onClick={() => handleAddBlock(block)}
                disabled={disabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  disabled
                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
                }`}
              >
                <span className="text-gray-400">{BLOCK_ICONS[block]}</span>
                {BLOCK_LABELS[block]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
