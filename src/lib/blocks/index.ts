/**
 * Global Block Library
 *
 * Centralized block rendering system for newsletters.
 * Blocks are reusable components that can be composed into sections.
 *
 * Usage:
 *   import { renderBlock, renderBlocks, getBlockRenderer } from '@/lib/blocks'
 *
 *   // Render a single block
 *   const html = renderBlock('title', data, styles)
 *
 *   // Render multiple blocks in order
 *   const html = renderBlocks(['title', 'image', 'ad_body'], data, styles)
 */

// Export types
export type {
  BlockType,
  AdBlockType,
  PrimaryArticleBlockType,
  SecondaryArticleBlockType,
  BlockStyleOptions,
  BlockRenderContext,
  BlockData,
  BlockRenderer,
  BlockDefinition
} from './types'

// Export registry functions
export {
  getBlockRenderer,
  getBlockDefinition,
  getAllBlockTypes,
  getBlockTypesByCategory,
  renderBlock,
  renderBlocks
} from './registry'

// Export individual renderers for direct use if needed
export { renderTitleBlock } from './renderers/title'
export { renderImageBlock } from './renderers/image'
export { renderBodyBlock } from './renderers/body'
export { renderButtonBlock } from './renderers/button'
