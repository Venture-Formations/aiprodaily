'use client'

import {
  DndContext,
  closestCenter,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import type { TextBoxBlock } from '@/types/database'
import { SortableBlockItem } from '../SortableBlockItem'
import { StaticTextBlockEditor } from './StaticTextBlockEditor'
import { AIPromptBlockEditor } from './AIPromptBlockEditor'
import { ImageBlockEditor } from './ImageBlockEditor'
import { detectProviderFromPrompt } from './types'
import { getBlockTypeBadge } from './utils'
import type { TestResult } from './types'
import type { Crop, PixelCrop } from 'react-image-crop'

interface BlocksTabProps {
  blocks: TextBoxBlock[]
  loading: boolean
  saving: boolean
  expandedBlock: string | null
  editingBlock: string | null
  sensors: SensorDescriptor<SensorOptions>[]

  // Static text state
  editContent: string
  setEditContent: (val: string) => void
  editTextSize: 'small' | 'medium' | 'large'
  setEditTextSize: (val: 'small' | 'medium' | 'large') => void

  // AI prompt state
  editPrompt: string
  setEditPrompt: (val: string) => void
  editTiming: 'before_articles' | 'after_articles'
  setEditTiming: (val: 'before_articles' | 'after_articles') => void
  editIsBold: boolean
  setEditIsBold: (val: boolean) => void
  editIsItalic: boolean
  setEditIsItalic: (val: boolean) => void
  editResponseField: string
  setEditResponseField: (val: string) => void
  testingPrompt: boolean
  testResult: TestResult | null

  // Image state
  editImageType: 'static' | 'ai_generated'
  setEditImageType: (val: 'static' | 'ai_generated') => void
  editAiImagePrompt: string
  setEditAiImagePrompt: (val: string) => void
  editImageAlt: string
  setEditImageAlt: (val: string) => void
  selectedImage: string | null
  crop: Crop | undefined
  setCrop: (val: Crop | undefined) => void
  completedCrop: PixelCrop | undefined
  setCompletedCrop: (val: PixelCrop | undefined) => void
  uploadingImage: boolean
  aspectRatio: '16:9' | '5:4' | 'free'
  fileInputRef: React.RefObject<HTMLInputElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>

  // Handlers
  onToggleExpand: (blockId: string) => void
  onToggleBlockActive: (block: TextBoxBlock) => void
  onDeleteBlock: (blockId: string) => void
  onStartEdit: (block: TextBoxBlock) => void
  onCancelEdit: () => void
  onSaveBlock: (block: TextBoxBlock) => void
  onTestPrompt: () => void
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAspectRatioChange: (val: '16:9' | '5:4' | 'free') => void
  onDragEnd: (event: DragEndEvent) => void
  onAddBlock: (blockType: 'static_text' | 'ai_prompt' | 'image') => void
}

export function BlocksTab({
  blocks,
  loading,
  saving,
  expandedBlock,
  editingBlock,
  sensors,
  editContent,
  setEditContent,
  editTextSize,
  setEditTextSize,
  editPrompt,
  setEditPrompt,
  editTiming,
  setEditTiming,
  editIsBold,
  setEditIsBold,
  editIsItalic,
  setEditIsItalic,
  editResponseField,
  setEditResponseField,
  testingPrompt,
  testResult,
  editImageType,
  setEditImageType,
  editAiImagePrompt,
  setEditAiImagePrompt,
  editImageAlt,
  setEditImageAlt,
  selectedImage,
  crop,
  setCrop,
  completedCrop,
  setCompletedCrop,
  uploadingImage,
  aspectRatio,
  fileInputRef,
  imgRef,
  onToggleExpand,
  onToggleBlockActive,
  onDeleteBlock,
  onStartEdit,
  onCancelEdit,
  onSaveBlock,
  onTestPrompt,
  onImageSelect,
  onAspectRatioChange,
  onDragEnd,
  onAddBlock,
}: BlocksTabProps) {
  const renderBlockExpandedContent = (block: TextBoxBlock) => (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {block.block_type === 'static_text' && (
        <StaticTextBlockEditor
          block={block}
          isEditing={editingBlock === block.id}
          saving={saving}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveBlock={onSaveBlock}
          editContent={editContent}
          setEditContent={setEditContent}
          editTextSize={editTextSize}
          setEditTextSize={setEditTextSize}
        />
      )}

      {block.block_type === 'ai_prompt' && (
        <AIPromptBlockEditor
          block={block}
          isEditing={editingBlock === block.id}
          saving={saving}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveBlock={onSaveBlock}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          editTiming={editTiming}
          setEditTiming={setEditTiming}
          editIsBold={editIsBold}
          setEditIsBold={setEditIsBold}
          editIsItalic={editIsItalic}
          setEditIsItalic={setEditIsItalic}
          editResponseField={editResponseField}
          setEditResponseField={setEditResponseField}
          testingPrompt={testingPrompt}
          testResult={testResult}
          onTestPrompt={onTestPrompt}
        />
      )}

      {block.block_type === 'image' && (
        <ImageBlockEditor
          block={block}
          isEditing={editingBlock === block.id}
          saving={saving}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveBlock={onSaveBlock}
          editImageType={editImageType}
          setEditImageType={setEditImageType}
          editAiImagePrompt={editAiImagePrompt}
          setEditAiImagePrompt={setEditAiImagePrompt}
          editImageAlt={editImageAlt}
          setEditImageAlt={setEditImageAlt}
          selectedImage={selectedImage}
          crop={crop}
          setCrop={setCrop}
          completedCrop={completedCrop}
          setCompletedCrop={setCompletedCrop}
          uploadingImage={uploadingImage}
          aspectRatio={aspectRatio}
          onAspectRatioChange={onAspectRatioChange}
          onImageSelect={onImageSelect}
          fileInputRef={fileInputRef}
          imgRef={imgRef}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No blocks yet. Add your first block to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {blocks.map((block) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  isActive={block.is_active}
                  isExpanded={expandedBlock === block.id}
                  isEditing={editingBlock === block.id}
                  saving={saving}
                  onToggleExpand={() => onToggleExpand(block.id)}
                  onToggleActive={() => onToggleBlockActive(block)}
                  onDelete={() => onDeleteBlock(block.id)}
                  onStartEdit={() => {
                    onToggleExpand(block.id)
                    if (editingBlock !== block.id) {
                      onStartEdit(block)
                    }
                  }}
                  getBlockTypeBadge={getBlockTypeBadge}
                  detectProviderFromPrompt={detectProviderFromPrompt}
                >
                  {expandedBlock === block.id && renderBlockExpandedContent(block)}
                </SortableBlockItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Block Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <button
          onClick={() => onAddBlock('static_text')}
          disabled={saving}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 text-gray-700 transition-colors disabled:opacity-50"
        >
          + Static Text
        </button>
        <button
          onClick={() => onAddBlock('ai_prompt')}
          disabled={saving}
          className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 text-purple-700 transition-colors disabled:opacity-50"
        >
          + AI Prompt
        </button>
        <button
          onClick={() => onAddBlock('image')}
          disabled={saving}
          className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 text-green-700 transition-colors disabled:opacity-50"
        >
          + Image
        </button>
      </div>
    </div>
  )
}
