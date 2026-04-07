'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ArticleWithRssPost, CriteriaConfig } from './types'
import { ArticleCard } from './ArticleCard'

interface ArticleModuleListProps {
  moduleId: string
  articles: ArticleWithRssPost[]
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  onReorder: (articleIds: string[]) => void
  getScoreColor: (score: number) => string
}

function SortableArticleCard({
  article,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  getScoreColor
}: {
  article: ArticleWithRssPost
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  getScoreColor: (score: number) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id, disabled: isSent })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ArticleCard
        article={article}
        criteriaConfig={criteriaConfig}
        isSent={isSent}
        saving={saving}
        onToggle={onToggle}
        onSkip={onSkip}
        getScoreColor={getScoreColor}
        dragHandleProps={{ ...attributes, ...listeners }}
        showDragHandle={true}
      />
    </div>
  )
}

export function ArticleModuleList({
  moduleId,
  articles,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  onReorder,
  getScoreColor
}: ArticleModuleListProps) {
  const activeArticles = articles.filter(a => a.is_active && !a.skipped).sort((a, b) => (a.rank || 999) - (b.rank || 999))
  const inactiveArticles = articles.filter(a => !a.is_active && !a.skipped)
  const skippedArticles = articles.filter(a => a.skipped)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = activeArticles.findIndex(a => a.id === active.id)
      const newIndex = activeArticles.findIndex(a => a.id === over.id)
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)
      onReorder(newOrder.map(a => a.id))
    }
  }

  return (
    <div className="space-y-2">
      {activeArticles.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeArticles.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {activeArticles.map((article) => (
              <SortableArticleCard
                key={article.id}
                article={article}
                criteriaConfig={criteriaConfig}
                isSent={isSent}
                saving={saving}
                onToggle={onToggle}
                onSkip={onSkip}
                getScoreColor={getScoreColor}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {inactiveArticles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          criteriaConfig={criteriaConfig}
          isSent={isSent}
          saving={saving}
          onToggle={onToggle}
          onSkip={onSkip}
          getScoreColor={getScoreColor}
        />
      ))}

      {skippedArticles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Skipped Articles ({skippedArticles.length})</h4>
          {skippedArticles.map((article) => (
            <div key={article.id} className="p-3 bg-gray-100 rounded-lg mb-2 opacity-60">
              <span className="text-sm text-gray-600 line-through">{article.headline}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
