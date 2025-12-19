/**
 * Global Block Library - Type Definitions
 *
 * Blocks are reusable rendering components that can be composed
 * into sections. Change a block here, and it updates everywhere.
 */

/**
 * All available block types in the system
 */
export type BlockType =
  // Ad blocks (matches database schema)
  | 'title'
  | 'image'
  | 'body'      // Ad body with last-sentence-link logic
  | 'button'
  // Article blocks
  | 'headline'
  | 'content'   // Article content (different from ad body)
  | 'source'
  | 'snippet'
  | 'read_more'
  // Poll blocks
  | 'question'   // Poll question text
  | 'options'    // Poll voting options

/**
 * Block types specifically for ad modules
 * Matches database ad_modules.block_order schema
 */
export type AdBlockType = 'title' | 'image' | 'body' | 'button'

/**
 * Block types specifically for primary articles
 */
export type PrimaryArticleBlockType = 'headline' | 'image' | 'content' | 'source' | 'read_more'

/**
 * Block types specifically for secondary articles
 */
export type SecondaryArticleBlockType = 'headline' | 'snippet' | 'source' | 'read_more'

/**
 * Block types specifically for poll modules
 * Matches database poll_modules.block_order schema
 */
export type PollBlockType = 'title' | 'question' | 'image' | 'options'

/**
 * Styling options passed to block renderers
 * These come from publication settings
 */
export interface BlockStyleOptions {
  primaryColor: string
  secondaryColor?: string
  tertiaryColor?: string
  headingFont: string
  bodyFont: string
}

/**
 * Context for rendering blocks
 * Contains issue-specific info for URL tracking, etc.
 */
export interface BlockRenderContext {
  issueId?: string
  issueDate?: string
  mailerliteIssueId?: string
  publicationId?: string
}

/**
 * Data that can be passed to any block renderer
 * Each renderer uses the fields it needs
 */
export interface BlockData {
  // Text content
  title?: string
  headline?: string
  body?: string
  content?: string
  snippet?: string

  // Media
  image_url?: string

  // Links
  button_url?: string
  button_text?: string
  source_url?: string

  // Attribution
  source_name?: string
  author?: string

  // Tracking
  trackingUrl?: string

  // Poll-specific
  question?: string
  options?: string[]
  poll_id?: string
  issue_id?: string
  base_url?: string
}

/**
 * Function signature for a block renderer
 */
export type BlockRenderer = (
  data: BlockData,
  styles: BlockStyleOptions,
  context?: BlockRenderContext
) => string

/**
 * Block registry entry
 */
export interface BlockDefinition {
  type: BlockType
  name: string
  description: string
  render: BlockRenderer
}
