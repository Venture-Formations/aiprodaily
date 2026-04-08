'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableSectionItem, AddSectionModal, SelectedItemPanel, useSectionsPanel } from './sections-panel'
import type { SectionsPanelProps } from './sections-panel'

export default function SectionsPanel({ publicationId: propPublicationId }: SectionsPanelProps) {
  const {
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
    handleDragEnd,
    handleToggleSection,
    handleAddSection,
    handleUpdateModule,
    handleDeleteModule,
    handleUpdatePollModule,
    handleDeletePollModule,
    handleUpdateAIAppModule,
    handleDeleteAIAppModule,
    handleUpdatePromptModule,
    handleDeletePromptModule,
    handleUpdateArticleModule,
    handleDeleteArticleModule,
    handleUpdateTextBoxModule,
    handleDeleteTextBoxModule,
    handleUpdateFeedbackModule,
    handleUpdateFeedbackBlock,
    handleReorderFeedbackBlocks,
    handleAddFeedbackBlock,
    handleDeleteFeedbackBlock,
    handleDeleteFeedbackModule,
    handleUpdateSparkLoopRecModule,
    handleDeleteSparkLoopRecModule,
    handleCooldownChange,
    handleUpdateSection,
  } = useSectionsPanel(propPublicationId)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Left Panel - Section List */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">Sections</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>

        <div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {allItems.map(item => {
                  const id = item.type === 'section' ? `section-${item.data.id}` : `module-${item.data.id}`
                  const isSelected = selectedItem?.data.id === item.data.id && selectedItem?.type === item.type

                  return (
                    <SortableSectionItem
                      key={id}
                      item={item}
                      isSelected={isSelected}
                      onSelect={() => setSelectedItem(item)}
                      onToggle={() => handleToggleSection(item)}
                      disabled={saving}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Right Panel - Settings */}
      <div className="flex-1 bg-gray-50 rounded-lg p-6">
        <SelectedItemPanel
          selectedItem={selectedItem}
          publicationId={publicationId}
          cooldownDays={cooldownDays}
          saving={saving}
          handlers={{
            handleUpdateModule,
            handleDeleteModule,
            handleUpdatePollModule,
            handleDeletePollModule,
            handleUpdateAIAppModule,
            handleDeleteAIAppModule,
            handleUpdatePromptModule,
            handleDeletePromptModule,
            handleUpdateArticleModule,
            handleDeleteArticleModule,
            handleUpdateTextBoxModule,
            handleDeleteTextBoxModule,
            handleUpdateFeedbackModule,
            handleUpdateFeedbackBlock,
            handleReorderFeedbackBlocks,
            handleAddFeedbackBlock,
            handleDeleteFeedbackBlock,
            handleDeleteFeedbackModule,
            handleUpdateSparkLoopRecModule,
            handleDeleteSparkLoopRecModule,
            handleCooldownChange,
            handleUpdateSection,
          }}
        />
      </div>

      {/* Add Section Modal */}
      <AddSectionModal
        showAddModal={showAddModal}
        newSectionType={newSectionType}
        newModuleName={newModuleName}
        saving={saving}
        feedbackModuleExists={feedbackModules.length > 0}
        onSectionTypeChange={setNewSectionType}
        onModuleNameChange={setNewModuleName}
        onAdd={handleAddSection}
        onClose={() => {
          setShowAddModal(false)
          setNewModuleName('')
          setNewSectionType('ad')
        }}
      />
    </div>
  )
}
