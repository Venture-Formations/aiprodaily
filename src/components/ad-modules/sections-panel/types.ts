import type { NewsletterSection, AdModule, PollModule, AIAppModule, PromptModule, ArticleModule, TextBoxModule, FeedbackModuleWithBlocks, SparkLoopRecModule } from '@/types/database'

export interface SectionsPanelProps {
  publicationId?: string
}

export type SectionItem =
  | { type: 'section'; data: NewsletterSection }
  | { type: 'ad_module'; data: AdModule }
  | { type: 'poll_module'; data: PollModule }
  | { type: 'ai_app_module'; data: AIAppModule }
  | { type: 'prompt_module'; data: PromptModule }
  | { type: 'article_module'; data: ArticleModule }
  | { type: 'text_box_module'; data: TextBoxModule }
  | { type: 'feedback_module'; data: FeedbackModuleWithBlocks }
  | { type: 'sparkloop_rec_module'; data: SparkLoopRecModule }

export function getItemId(item: SectionItem): string {
  if (item.type === 'section') return `section-${item.data.id}`
  if (item.type === 'ad_module') return `ad-module-${item.data.id}`
  if (item.type === 'poll_module') return `poll-module-${item.data.id}`
  if (item.type === 'ai_app_module') return `ai-app-module-${item.data.id}`
  if (item.type === 'article_module') return `article-module-${item.data.id}`
  if (item.type === 'text_box_module') return `text-box-module-${item.data.id}`
  if (item.type === 'feedback_module') return `feedback-module-${item.data.id}`
  if (item.type === 'sparkloop_rec_module') return `sparkloop-rec-module-${item.data.id}`
  return `prompt-module-${item.data.id}`
}

export const MODULE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  ad_module: { label: 'Ad', bg: 'bg-blue-100', text: 'text-blue-700' },
  poll_module: { label: 'Poll', bg: 'bg-purple-100', text: 'text-purple-700' },
  ai_app_module: { label: 'Products', bg: 'bg-green-100', text: 'text-green-700' },
  prompt_module: { label: 'Prompt', bg: 'bg-amber-100', text: 'text-amber-700' },
  article_module: { label: 'Articles', bg: 'bg-rose-100', text: 'text-rose-700' },
  text_box_module: { label: 'Text Box', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  feedback_module: { label: 'Feedback', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  sparkloop_rec_module: { label: 'SparkLoop', bg: 'bg-orange-100', text: 'text-orange-700' },
}

export type NewSectionType = 'ad' | 'poll' | 'ai_app' | 'prompt' | 'article' | 'text_box' | 'feedback' | 'sparkloop_rec' | 'standard'

export const SECTION_TYPE_CONFIG: Array<{
  type: NewSectionType
  label: string
  description: string
  color: string
  activeColor: string
}> = [
  { type: 'ad', label: 'Ad', description: 'Ad placement', color: 'blue', activeColor: 'border-blue-500 bg-blue-50 text-blue-700' },
  { type: 'poll', label: 'Poll', description: 'Poll section', color: 'purple', activeColor: 'border-purple-500 bg-purple-50 text-purple-700' },
  { type: 'ai_app', label: 'Product Cards', description: 'Product showcase', color: 'green', activeColor: 'border-green-500 bg-green-50 text-green-700' },
  { type: 'prompt', label: 'Prompt', description: 'AI prompt', color: 'amber', activeColor: 'border-amber-500 bg-amber-50 text-amber-700' },
  { type: 'article', label: 'Articles', description: 'News section', color: 'rose', activeColor: 'border-rose-500 bg-rose-50 text-rose-700' },
  { type: 'text_box', label: 'Text Box', description: 'Text & images', color: 'cyan', activeColor: 'border-cyan-500 bg-cyan-50 text-cyan-700' },
  { type: 'sparkloop_rec', label: 'SparkLoop', description: 'Recommendations', color: 'orange', activeColor: 'border-orange-500 bg-orange-50 text-orange-700' },
  { type: 'feedback', label: 'Feedback', description: 'Star ratings', color: 'yellow', activeColor: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
  { type: 'standard', label: 'Standard', description: 'Content', color: 'gray', activeColor: 'border-gray-500 bg-gray-100 text-gray-700' },
]

export const SECTION_TYPE_PLACEHOLDERS: Record<NewSectionType, string> = {
  ad: 'e.g., Sidebar Sponsor',
  poll: 'e.g., Weekly Poll',
  ai_app: 'e.g., Products Spotlight',
  prompt: 'e.g., Prompt of the Day',
  article: 'e.g., Top Stories',
  text_box: 'e.g., Welcome Section',
  sparkloop_rec: 'e.g., Recommended Newsletters',
  feedback: 'e.g., Rate This Issue',
  standard: 'e.g., Featured Content',
}
