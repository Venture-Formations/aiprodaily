/**
 * Ad Modules System
 *
 * Dynamic ad sections that can be created and configured via admin UI.
 * Each module consists of configurable blocks (title, image, body, button)
 * that can be reordered per section.
 */

export { ModuleAdSelector } from './ad-selector'
export { AdModuleRenderer } from './ad-renderer'

// Re-export types for convenience
export type {
  AdModule,
  ModuleAd,
  ModuleAdWithAdvertiser,
  Advertiser,
  AdBlockType,
  AdSelectionMode,
  ModuleAdStatus,
  IssueModuleAd
} from '@/types/database'
