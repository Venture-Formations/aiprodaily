'use client'

import React from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableFeedbackBlockItem } from '../SortableFeedbackBlockItem'
import { BlockExpandedContent } from './BlockExpandedContent'
import type { FeedbackBlock, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'

interface BlocksTabProps {
  blocks: FeedbackBlock[]
  saving: boolean
  sensors: SensorDescriptor<SensorOptions>[]
  expandedBlock: string | null
  editingBlock: string | null
  // Edit state
  editTitleText: string
  setEditTitleText: (v: string) => void
  editStaticContent: string
  setEditStaticContent: (v: string) => void
  editTextSize: 'small' | 'medium' | 'large'
  setEditTextSize: (v: 'small' | 'medium' | 'large') => void
  editVoteOptions: FeedbackVoteOption[]
  setEditVoteOptions: (v: FeedbackVoteOption[]) => void
  editTeamPhotos: FeedbackTeamMember[]
  setEditTeamPhotos: (v: FeedbackTeamMember[]) => void
  // Handlers
  onDragEnd: (event: DragEndEvent) => void
  onToggleExpand: (blockId: string) => void
  onToggleBlockActive: (block: FeedbackBlock) => void
  onDeleteBlock: (blockId: string) => void
  onStartEdit: (block: FeedbackBlock) => void
  onCancelEdit: () => void
  onSaveBlock: (block: FeedbackBlock) => void
  onAddBlock?: (blockType: FeedbackBlock['block_type']) => void
}

function getBlockTypeBadge(blockType: string): React.ReactNode {
  switch (blockType) {
    case 'title':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Title</span>
    case 'static_text':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Static Text</span>
    case 'vote_options':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Voting</span>
    case 'team_photos':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Team Photos</span>
    default:
      return null
  }
}

export function BlocksTab({
  blocks,
  saving,
  sensors,
  expandedBlock,
  editingBlock,
  editTitleText,
  setEditTitleText,
  editStaticContent,
  setEditStaticContent,
  editTextSize,
  setEditTextSize,
  editVoteOptions,
  setEditVoteOptions,
  editTeamPhotos,
  setEditTeamPhotos,
  onDragEnd,
  onToggleExpand,
  onToggleBlockActive,
  onDeleteBlock,
  onStartEdit,
  onCancelEdit,
  onSaveBlock,
  onAddBlock,
}: BlocksTabProps) {
  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
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
                <SortableFeedbackBlockItem
                  key={block.id}
                  block={block}
                  isActive={block.is_enabled}
                  isExpanded={expandedBlock === block.id}
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
                >
                  {/* Expanded content rendered as children */}
                  {expandedBlock === block.id && (
                    <BlockExpandedContent
                      block={block}
                      editingBlock={editingBlock}
                      saving={saving}
                      editTitleText={editTitleText}
                      setEditTitleText={setEditTitleText}
                      editStaticContent={editStaticContent}
                      setEditStaticContent={setEditStaticContent}
                      editTextSize={editTextSize}
                      setEditTextSize={setEditTextSize}
                      editVoteOptions={editVoteOptions}
                      setEditVoteOptions={setEditVoteOptions}
                      editTeamPhotos={editTeamPhotos}
                      setEditTeamPhotos={setEditTeamPhotos}
                      onCancelEdit={onCancelEdit}
                      onSaveBlock={onSaveBlock}
                      onStartEdit={onStartEdit}
                    />
                  )}
                </SortableFeedbackBlockItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Block Buttons */}
      {onAddBlock && (
        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={() => onAddBlock('static_text')}
            disabled={saving}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 text-gray-700 transition-colors disabled:opacity-50"
          >
            + Static Text
          </button>
          <button
            onClick={() => onAddBlock('vote_options')}
            disabled={saving}
            className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 text-amber-700 transition-colors disabled:opacity-50"
          >
            + Vote Options
          </button>
          <button
            onClick={() => onAddBlock('team_photos')}
            disabled={saving}
            className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 text-green-700 transition-colors disabled:opacity-50"
          >
            + Team Photos
          </button>
        </div>
      )}
    </div>
  )
}
