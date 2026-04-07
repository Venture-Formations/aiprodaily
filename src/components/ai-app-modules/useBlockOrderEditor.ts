import { useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import type { AIAppBlockType, ProductCardBlockConfig } from '@/types/database'

const ALL_BLOCK_TYPES: AIAppBlockType[] = ['logo', 'title', 'description', 'tagline', 'image', 'button']

// Get default config for a block type
export function getDefaultBlockConfig(blockType: AIAppBlockType): ProductCardBlockConfig[keyof ProductCardBlockConfig] {
  switch (blockType) {
    case 'logo':
      return { enabled: true, style: 'square', position: 'left' } as any
    case 'title':
    case 'description':
    case 'tagline':
      return { enabled: true, size: 'medium' } as any
    case 'image':
    case 'button':
      return { enabled: true }
    default:
      return { enabled: true }
  }
}

// Get badge text for a block's settings
export function getSettingsBadge(
  block: AIAppBlockType,
  config: ProductCardBlockConfig[keyof ProductCardBlockConfig] | undefined
): string | null {
  if (!config) return null
  if (block === 'logo' && 'style' in config && 'position' in config) {
    return `${config.style}, ${config.position}`
  }
  if ((block === 'title' || block === 'description' || block === 'tagline') && 'size' in config) {
    return config.size as string
  }
  if (block === 'button' && 'staticText' in config && config.staticText) {
    return config.staticText as string
  }
  return null
}

interface UseBlockOrderEditorProps {
  blockOrder: AIAppBlockType[]
  blockConfig: ProductCardBlockConfig
  onOrderChange: (newOrder: AIAppBlockType[]) => void
  onConfigChange: (newConfig: ProductCardBlockConfig) => void
}

export function useBlockOrderEditor({
  blockOrder,
  blockConfig,
  onOrderChange,
  onConfigChange
}: UseBlockOrderEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const availableBlocks = ALL_BLOCK_TYPES.filter(block => !blockOrder.includes(block))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id && over) {
      const activeBlock = active.id as AIAppBlockType
      const overBlock = over.id as AIAppBlockType
      const oldIndex = blockOrder.indexOf(activeBlock)
      const newIndex = blockOrder.indexOf(overBlock)
      if (oldIndex !== -1 && newIndex !== -1) {
        onOrderChange(arrayMove(blockOrder, oldIndex, newIndex))
      }
    }
  }

  const handleToggleBlock = (block: AIAppBlockType) => {
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    const isCurrentlyEnabled = currentConfig?.enabled ?? true
    onConfigChange({
      ...blockConfig,
      [block]: { ...currentConfig, enabled: !isCurrentlyEnabled }
    })
  }

  const handleDeleteBlock = (block: AIAppBlockType) => {
    onOrderChange(blockOrder.filter(b => b !== block))
  }

  const handleAddBlock = (block: AIAppBlockType) => {
    onOrderChange([...blockOrder, block])
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    onConfigChange({
      ...blockConfig,
      [block]: { ...currentConfig, enabled: true }
    })
  }

  const handleSettingChange = (block: AIAppBlockType, key: string, value: string | boolean) => {
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    onConfigChange({
      ...blockConfig,
      [block]: { ...currentConfig, [key]: value }
    })
  }

  return {
    sensors,
    availableBlocks,
    handleDragEnd,
    handleToggleBlock,
    handleDeleteBlock,
    handleAddBlock,
    handleSettingChange,
  }
}
