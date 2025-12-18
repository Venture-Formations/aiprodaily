/**
 * Block Registry
 *
 * Central registry that maps block types to their renderers.
 * This is the single source of truth for all block rendering.
 *
 * To add a new block:
 * 1. Create a renderer in ./renderers/
 * 2. Add the type to types.ts
 * 3. Register it here
 */

import type { BlockType, BlockRenderer, BlockDefinition, BlockData, BlockStyleOptions, BlockRenderContext } from './types'

// Import block renderers
import { renderTitleBlock } from './renderers/title'
import { renderImageBlock } from './renderers/image'
import { renderBodyBlock } from './renderers/body'
import { renderButtonBlock } from './renderers/button'

/**
 * Block definitions with metadata
 */
const blockDefinitions: Record<BlockType, BlockDefinition> = {
  // Ad module blocks
  title: {
    type: 'title',
    name: 'Title',
    description: 'Heading text for ads',
    render: renderTitleBlock
  },
  image: {
    type: 'image',
    name: 'Image',
    description: 'Featured image with optional link',
    render: renderImageBlock
  },
  body: {
    type: 'body',
    name: 'Body',
    description: 'Ad content with last sentence linked',
    render: renderBodyBlock
  },
  button: {
    type: 'button',
    name: 'Button',
    description: 'Call-to-action button',
    render: renderButtonBlock
  },

  // Article blocks (to be implemented)
  headline: {
    type: 'headline',
    name: 'Headline',
    description: 'Article headline/title',
    render: () => '' // TODO: Implement
  },
  content: {
    type: 'content',
    name: 'Content',
    description: 'Article body content',
    render: () => '' // TODO: Implement
  },
  source: {
    type: 'source',
    name: 'Source',
    description: 'Source attribution',
    render: () => '' // TODO: Implement
  },
  snippet: {
    type: 'snippet',
    name: 'Snippet',
    description: 'Short excerpt/description',
    render: () => '' // TODO: Implement
  },
  read_more: {
    type: 'read_more',
    name: 'Read More',
    description: 'Link to full article',
    render: () => '' // TODO: Implement
  }
}

/**
 * Get a block renderer by type
 * @param blockType - The type of block to render
 * @returns The renderer function, or undefined if not found
 */
export function getBlockRenderer(blockType: BlockType): BlockRenderer | undefined {
  return blockDefinitions[blockType]?.render
}

/**
 * Get block definition by type
 * @param blockType - The type of block
 * @returns The full block definition
 */
export function getBlockDefinition(blockType: BlockType): BlockDefinition | undefined {
  return blockDefinitions[blockType]
}

/**
 * Get all available block types
 * @returns Array of all block types
 */
export function getAllBlockTypes(): BlockType[] {
  return Object.keys(blockDefinitions) as BlockType[]
}

/**
 * Get block types for a specific category
 * @param category - 'ad' | 'article'
 * @returns Array of block types for that category
 */
export function getBlockTypesByCategory(category: 'ad' | 'article'): BlockType[] {
  if (category === 'ad') {
    return ['title', 'image', 'body', 'button']
  }
  return ['headline', 'image', 'content', 'source', 'snippet', 'read_more']
}

/**
 * Render a single block
 * @param blockType - The type of block to render
 * @param data - Data for the block
 * @param styles - Style options
 * @param context - Render context
 * @returns HTML string, or empty string if block type not found
 */
export function renderBlock(
  blockType: BlockType,
  data: BlockData,
  styles: BlockStyleOptions,
  context?: BlockRenderContext
): string {
  const renderer = getBlockRenderer(blockType)
  if (!renderer) {
    console.warn(`[BlockRegistry] Unknown block type: ${blockType}`)
    return ''
  }
  return renderer(data, styles, context)
}

/**
 * Render multiple blocks in order
 * @param blockTypes - Array of block types in order
 * @param data - Data for all blocks
 * @param styles - Style options
 * @param context - Render context
 * @returns Combined HTML string
 */
export function renderBlocks(
  blockTypes: BlockType[],
  data: BlockData,
  styles: BlockStyleOptions,
  context?: BlockRenderContext
): string {
  return blockTypes
    .map(type => renderBlock(type, data, styles, context))
    .join('')
}
