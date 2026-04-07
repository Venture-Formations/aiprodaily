// Types and helpers for the newsletter archive page

export type RenderItem =
  | { type: 'section'; data: any; display_order: number }
  | { type: 'ad_module'; data: any; display_order: number }
  | { type: 'poll_module'; data: any; display_order: number }
  | { type: 'ai_app_module'; data: any; display_order: number }
  | { type: 'prompt_module'; data: any; display_order: number }
  | { type: 'article_module'; data: any; display_order: number }
  | { type: 'text_box_module'; data: any; display_order: number }
  | { type: 'legacy_ai_apps'; data: any; display_order: number }
  | { type: 'legacy_prompt'; data: any; display_order: number }

export const SECTION_IDS = {
  AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
  PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
  ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d'
} as const

/** Replace MailerLite merge tags with their default values for website display */
export function cleanMergeTags(text: string): string {
  return text.replace(/\{\$name\|default:"([^"]+)"\}/g, '$1')
    .replace(/\{\$[^}]+\}/g, '')
}

/** Parse a YYYY-MM-DD date string as a local date and format it */
export function formatLocalDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/** Get display_order for a section by ID from the config array */
export function getDisplayOrder(sectionId: string, sectionsConfig: any[] | null): number {
  const section = sectionsConfig?.find((s: any) => s.id === sectionId)
  return section?.display_order ?? 999
}

/** Build the sorted list of all renderable items */
export function buildRenderItems(
  newsletterSectionsConfig: any[] | null,
  adModules: any[],
  pollModules: any[],
  aiAppModules: any[],
  promptModules: any[],
  articleModules: any[],
  textBoxModules: any[],
  aiApps: any[],
  legacyPrompt: any
): RenderItem[] {
  const hasValidAiAppModules = aiAppModules.some((m: any) => m.apps && m.apps.length > 0)
  const hasValidPromptModules = promptModules.some((m: any) => m.prompt)
  const hasValidArticleModules = articleModules.some((m: any) => m.articles && m.articles.length > 0)

  return [
    // Newsletter sections (excluding Advertisement, AI Applications, Prompt Ideas, and article sections handled by modules/legacy)
    ...(newsletterSectionsConfig || [])
      .filter((s: any) => {
        if (s.id === SECTION_IDS.ADVERTISEMENT || s.id === SECTION_IDS.AI_APPLICATIONS || s.id === SECTION_IDS.PROMPT_IDEAS) {
          return false
        }
        if (hasValidArticleModules && (s.section_type === 'primary_articles' || s.section_type === 'secondary_articles')) {
          return false
        }
        return true
      })
      .map((s: any) => ({ type: 'section' as const, data: s, display_order: s.display_order ?? 999 })),
    // Ad modules
    ...adModules.map((m: any) => ({ type: 'ad_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // Poll modules
    ...pollModules.map((m: any) => ({ type: 'poll_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // AI App modules (new system) - only include if they have apps
    ...aiAppModules
      .filter((m: any) => m.apps && m.apps.length > 0)
      .map((m: any) => ({ type: 'ai_app_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // Legacy AI Apps (only if no valid ai_app_modules with actual apps)
    ...(aiApps.length > 0 && !hasValidAiAppModules ? [{
      type: 'legacy_ai_apps' as const,
      data: aiApps,
      display_order: getDisplayOrder(SECTION_IDS.AI_APPLICATIONS, newsletterSectionsConfig)
    }] : []),
    // Prompt modules (new system) - only include if they have a prompt
    ...promptModules
      .filter((m: any) => m.prompt)
      .map((m: any) => ({ type: 'prompt_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // Legacy Prompt (only if no valid prompt_modules with actual prompts)
    ...(legacyPrompt && !hasValidPromptModules ? [{
      type: 'legacy_prompt' as const,
      data: legacyPrompt,
      display_order: getDisplayOrder(SECTION_IDS.PROMPT_IDEAS, newsletterSectionsConfig)
    }] : []),
    // Article modules (new dynamic article sections)
    ...articleModules
      .filter((m: any) => m.articles && m.articles.length > 0)
      .map((m: any) => ({ type: 'article_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // Text box modules (replaces legacy welcome section)
    ...textBoxModules
      .filter((m: any) => m.blocks && m.blocks.length > 0)
      .map((m: any) => ({ type: 'text_box_module' as const, data: m, display_order: m.display_order ?? 999 }))
  ].sort((a, b) => a.display_order - b.display_order)
}
