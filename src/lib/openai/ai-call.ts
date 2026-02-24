import { callAIWithPrompt } from './core'

// Complete AI call interface - fetches prompt+provider, replaces placeholders, calls AI
export const AI_CALL = {
  contentEvaluator: async (post: { title: string; description: string; content?: string; hasImage?: boolean }, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    const imagePenaltyText = post.hasImage
      ? 'This post HAS an image.'
      : 'This post has NO image - subtract 5 points from interest_level.'

    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_content_evaluator', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1000) + '...' : 'No content available',
      imagePenalty: imagePenaltyText
    })
  },

  primaryArticleTitle: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, maxTokens = 200, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_primary_article_title', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || ''
    })
  },

  primaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, headline: string, maxTokens = 500, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_primary_article_body', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || '',
      headline: headline
    })
  },

  secondaryArticleTitle: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, maxTokens = 200, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_secondary_article_title', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || ''
    })
  },

  secondaryArticleBody: async (post: { title: string; description: string; content?: string; source_url?: string }, newsletterId: string, headline: string, maxTokens = 500, temperature = 0.7) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_secondary_article_body', newsletterId, {
      title: post.title,
      description: post.description || 'No description available',
      content: post.content ? post.content.substring(0, 1500) + '...' : 'No additional content',
      url: post.source_url || '',
      headline: headline
    })
  },

  subjectLineGenerator: async (top_article: { headline: string; content: string }, newsletterId: string, maxTokens = 100, temperature = 0.8) => {
    // Use callAIWithPrompt to load complete config from database
    // Pass both title and headline for prompt compatibility
    return callAIWithPrompt('ai_prompt_subject_line', newsletterId, {
      title: top_article.headline,
      headline: top_article.headline,
      content: top_article.content
    })
  },

  welcomeSection: async (articles: Array<{ headline: string; content: string }>, newsletterId: string, maxTokens = 500, temperature = 0.8) => {
    // Format articles as JSON string for placeholder replacement
    const articlesJson = JSON.stringify(articles.map(a => ({
      headline: a.headline,
      content: a.content.substring(0, 1000) + (a.content.length > 1000 ? '...' : '')
    })))

    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_welcome_section', newsletterId, {
      articles: articlesJson
    })
  },

  topicDeduper: async (posts: Array<{ title: string; description: string; full_article_text: string }>, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    // Format posts as numbered list for placeholder replacement
    const postsFormatted = posts.map((post, i) =>
      `${i}. Title: ${post.title}\n   Description: ${post.description || 'No description'}\n   Full Article: ${post.full_article_text ? post.full_article_text.substring(0, 1500) + (post.full_article_text.length > 1500 ? '...' : '') : 'No full text available'}`
    ).join('\n\n')

    // Use callAIWithPrompt to load complete config from database
    // Support both {{articles}} and {{posts}} placeholders for compatibility
    return callAIWithPrompt('ai_prompt_topic_deduper', newsletterId, {
      articles: postsFormatted,
      posts: postsFormatted  // Also support {{posts}} placeholder
    })
  },

  factChecker: async (newsletterContent: string, originalContent: string, newsletterId: string, maxTokens = 1000, temperature = 0.3) => {
    // Use callAIWithPrompt to load complete config from database
    return callAIWithPrompt('ai_prompt_fact_checker', newsletterId, {
      newsletter_content: newsletterContent,
      original_content: originalContent
    })
  }
}
