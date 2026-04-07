import type { RenderItem } from '../types'
import { cleanMergeTags } from '../types'
import AdModuleSection from './AdModuleSection'
import AiAppModuleSection from './AiAppModuleSection'
import ArticleModuleSection from './ArticleModuleSection'
import ArticlesSection from './ArticlesSection'
import LegacyAiAppsSection from './LegacyAiAppsSection'
import LegacyPollSection from './LegacyPollSection'
import LegacyPromptSection from './LegacyPromptSection'
import PollModuleSection from './PollModuleSection'
import PromptModuleSection from './PromptModuleSection'
import RoadWorkSection from './RoadWorkSection'
import TextBoxModuleSection from './TextBoxModuleSection'
import WelcomeSection from './WelcomeSection'

interface RenderItemListProps {
  items: RenderItem[]
  /** Primary articles from the newsletter (legacy) */
  articles: any[]
  /** Secondary articles from the newsletter (legacy) */
  secondaryArticles: any[]
  /** Legacy welcome section data */
  welcome: any
  /** Legacy poll section data */
  poll: any
  /** Legacy road work section data */
  roadWork: any
  /** Whether text_box_modules exist (suppresses legacy welcome) */
  hasTextBoxModules: boolean
}

export default function RenderItemList({
  items,
  articles,
  secondaryArticles,
  welcome,
  poll,
  roadWork,
  hasTextBoxModules,
}: RenderItemListProps) {
  return (
    <>
      {items.map((item) => {
        // Render newsletter sections
        if (item.type === 'section') {
          const section = item.data

          // Welcome Section (legacy - only render if no text_box_modules)
          if (section.section_type === 'welcome' && !hasTextBoxModules && welcome && (welcome.intro || welcome.tagline || welcome.summary)) {
            return <WelcomeSection key={section.id} sectionId={section.id} welcome={welcome} />
          }

          // Primary Articles Section
          if (section.section_type === 'primary_articles' && articles.length > 0) {
            return <ArticlesSection key={section.id} sectionId={section.id} sectionName={section.name} articles={articles} />
          }

          // Secondary Articles Section
          if (section.section_type === 'secondary_articles' && secondaryArticles.length > 0) {
            return <ArticlesSection key={section.id} sectionId={section.id} sectionName={section.name} articles={secondaryArticles} />
          }

          // Poll Section (legacy)
          if (section.section_type === 'poll' && poll) {
            return <LegacyPollSection key={section.id} sectionId={section.id} sectionName={section.name} poll={poll} />
          }

          // Road Work Section
          if (section.name === 'Road Work' && roadWork) {
            return <RoadWorkSection key={section.id} sectionId={section.id} sectionName={section.name} roadWork={roadWork} />
          }

          return null
        }

        // Render Ad Modules
        if (item.type === 'ad_module') {
          return <AdModuleSection key={`ad-${item.data.module_name}`} adModule={item.data} />
        }

        // Render Poll Modules
        if (item.type === 'poll_module') {
          return <PollModuleSection key={`poll-${item.data.module_name}`} pollModule={item.data} />
        }

        // Render AI App Modules
        if (item.type === 'ai_app_module') {
          return <AiAppModuleSection key={`ai-app-${item.data.module_name}`} aiAppModule={item.data} />
        }

        // Render Prompt Modules
        if (item.type === 'prompt_module') {
          return <PromptModuleSection key={`prompt-${item.data.module_name}`} promptModule={item.data} />
        }

        // Render Article Modules
        if (item.type === 'article_module') {
          return <ArticleModuleSection key={`article-module-${item.data.module_name}`} articleModule={item.data} />
        }

        // Render Text Box Modules
        if (item.type === 'text_box_module') {
          return <TextBoxModuleSection key={`text-box-module-${item.data.module_id}`} textBoxModule={item.data} cleanMergeTags={cleanMergeTags} />
        }

        // Render Legacy AI Apps
        if (item.type === 'legacy_ai_apps') {
          return <LegacyAiAppsSection key="legacy-ai-apps" apps={item.data} />
        }

        // Render Legacy Prompt
        if (item.type === 'legacy_prompt') {
          return <LegacyPromptSection key="legacy-prompt" prompt={item.data} />
        }

        return null
      })}
    </>
  )
}
