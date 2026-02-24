// Re-export shim: all exports from the original newsletter-templates.ts
// Ensures all existing imports from '@/lib/newsletter-templates' continue to work

// Helpers
export {
  getLightBackground,
  formatEventDate,
  formatEventTime,
  getEventEmoji,
  getArticleEmoji,
  fetchBusinessSettings,
  getBreakingNewsEmoji,
  getAIAppEmoji,
} from './helpers'

// Layout (header + footer)
export {
  generateNewsletterHeader,
  generateNewsletterFooter,
} from './layout'

// Articles
export {
  generateArticleModuleSection,
  generatePrimaryArticlesSection,
  generateSecondaryArticlesSection,
} from './articles'

// Ads
export {
  generateDiningDealsSection,
  generateAdvertorialHtml,
  generateAdvertorialSection,
  generateAdModulesSection,
} from './ads'
export type { AdvertorialAdData, AdvertorialStyleOptions } from './ads'

// Sections (polls, breaking news, AI apps, prompts, text boxes, feedback, sparkloop, welcome, stubs)
export {
  generateWelcomeSection,
  generatePollSection,
  generatePollModulesSection,
  generateBreakingNewsSection,
  generateBeyondTheFeedSection,
  generateAIAppsSection,
  generatePromptModulesSection,
  generatePromptIdeasSection,
  generateTextBoxModuleSection,
  generateFeedbackModuleSection,
  generateSparkLoopRecModuleSection,
  generateLocalEventsSection,
  generateWordleSection,
  generateMinnesotaGetawaysSection,
  generateRoadWorkSection,
} from './sections'

// Full newsletter orchestrator
export { generateFullNewsletterHtml } from './full-newsletter'
