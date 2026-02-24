// Article rendering: module-based and legacy article sections

import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'
import { sanitizeAltText } from '../utils/sanitize-alt-text'
import { fetchBusinessSettings, getArticleEmoji } from './helpers'
import type { ArticleBlockType } from '@/types/database'
import type { BusinessSettings } from './types'

// ==================== ARTICLE MODULE SECTION ====================

export async function generateArticleModuleSection(
  issue: any,
  moduleId: string,
  includeUnsubscribeLink: boolean = false,
  businessSettings?: BusinessSettings
): Promise<string> {
  // Fetch the article mod
  const { data: mod } = await supabaseAdmin
    .from('article_modules')
    .select('*')
    .eq('id', moduleId)
    .single()

  if (!mod) {
    console.log(`[Article Module] Module ${moduleId} not found`)
    return ''
  }

  // Fetch active articles for this mod and issue
  const { data: articles } = await supabaseAdmin
    .from('module_articles')
    .select(`
      id,
      headline,
      content,
      is_active,
      rank,
      ai_image_url,
      image_alt,
      rss_post:rss_posts(
        source_url,
        image_url,
        image_alt
      )
    `)
    .eq('issue_id', issue.id)
    .eq('article_module_id', moduleId)
    .eq('is_active', true)
    .order('rank', { ascending: true })

  if (!articles || articles.length === 0) {
    console.log(`[Article Module] No active articles for mod ${mod.name}`)
    return ''
  }

  // Fetch colors and fonts from business settings (use passed-in settings if available)
  const { primaryColor, secondaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue.publication_id)

  // Get block order from mod settings
  const blockOrder: ArticleBlockType[] = mod.block_order || ['title', 'body']

  const articlesHtml = articles.map((article: any) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
    const sourceUrl = rssPost?.source_url || '#'
    const sourceImage = rssPost?.image_url || null
    const aiImage = article.ai_image_url || null
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, mod.name, issue.date, issue.mailerlite_issue_id, issue.id) : '#'

    // Convert newlines to <br> for proper HTML display
    const formattedContent = content.replace(/\n/g, '<br>')

    // Build blocks based on block_order
    const blocks: string[] = []
    for (const blockType of blockOrder) {
      if (blockType === 'source_image' && sourceImage) {
        const sourceAlt = sanitizeAltText(article.image_alt || rssPost?.image_alt || headline)
        blocks.push(`
          <div style="margin-bottom: 12px;">
            <img src="${sourceImage}" alt="${sourceAlt}" style="max-width: 100%; height: auto; border-radius: 8px;" />
          </div>
        `)
      } else if (blockType === 'ai_image' && aiImage) {
        const aiAlt = sanitizeAltText(article.image_alt || headline)
        blocks.push(`
          <div style="margin-bottom: 12px;">
            <img src="${aiImage}" alt="${aiAlt}" style="max-width: 100%; height: auto; border-radius: 8px;" />
          </div>
        `)
      } else if (blockType === 'title') {
        blocks.push(`
          <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; font-family: ${bodyFont};'>
            ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
          </div>
        `)
      } else if (blockType === 'body') {
        blocks.push(`
          <div style='font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};'>${formattedContent}</div>
        `)
      }
    }

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        ${blocks.join('')}
      </div>`
  }).join('')

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${mod.name}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${articlesHtml}
          </td>
        </tr>
        ${includeUnsubscribeLink ? `<tr>
          <td style="text-align: center; padding: 4px 10px 8px 10px;">
            <a href="{$unsubscribe}" style="font-size: 9px; color: #f3f3f3; text-decoration: none; font-family: ${bodyFont};">unsubscribe</a>
          </td>
        </tr>` : ''}
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== PRIMARY ARTICLES SECTION ====================
// @deprecated Use generateArticleModuleSection instead - this function is for backward compatibility only

export async function generatePrimaryArticlesSection(articles: any[], issueDate: string, issueId: string | undefined, sectionName: string, publication_id?: string, mailerliteIssueId?: string, businessSettings?: BusinessSettings): Promise<string> {
  if (!articles || articles.length === 0) {
    return ''
  }

  // Fetch colors and fonts from business settings (use passed-in settings if available)
  const { primaryColor, secondaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(publication_id)

  const articlesHtml = articles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const sourceUrl = article.rss_post?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking (pass both mailerlite ID and database issue ID)
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, issueDate, mailerliteIssueId, issueId) : '#'

    // Convert newlines to <br> for proper HTML display (AI responses contain \n for paragraphs)
    const formattedContent = content.replace(/\n/g, '<br>')

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; font-family: ${bodyFont};'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};'>${formattedContent}</div>
      </div>`
  }).join('')

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${articlesHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== SECONDARY ARTICLES SECTION ====================
// @deprecated Use generateArticleModuleSection instead - this function queries legacy secondary_articles table

export async function generateSecondaryArticlesSection(issue: any, sectionName: string, businessSettings?: BusinessSettings): Promise<string> {
  console.warn('[DEPRECATED] generateSecondaryArticlesSection called - use article modules instead')
  // Fetch secondary articles for this issue
  const { data: secondaryArticles } = await supabaseAdmin
    .from('secondary_articles')
    .select(`
      id,
      headline,
      content,
      is_active,
      rank,
      rss_post:rss_posts(
        source_url
      )
    `)
    .eq('issue_id', issue.id)
    .eq('is_active', true)
    .order('rank', { ascending: true })

  if (!secondaryArticles || secondaryArticles.length === 0) {
    return ''
  }

  // Fetch colors and fonts from business settings (use passed-in settings if available)
  const { primaryColor, secondaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

  const articlesHtml = secondaryArticles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
    const sourceUrl = rssPost?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, issue.date, issue.mailerlite_issue_id, issue.id) : '#'

    // Convert newlines to <br> for proper HTML display (AI responses contain \n for paragraphs)
    const formattedContent = content.replace(/\n/g, '<br>')

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; font-family: ${bodyFont};'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};'>${formattedContent}</div>
      </div>`
  }).join('')

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${articlesHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}
