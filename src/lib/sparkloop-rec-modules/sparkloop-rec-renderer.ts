/**
 * SparkLoop Recommendation Module Renderer
 *
 * Generates email-safe HTML cards for SparkLoop recommendations
 * that appear in the newsletter body.
 */

interface RecCard {
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.com'

export class SparkLoopRecModuleRenderer {
  /**
   * Render a full section with header and recommendation cards
   */
  static renderSection(
    sectionName: string,
    recs: RecCard[],
    issueId: string,
    primaryColor: string = '#1877F2',
    headingFont: string = 'Arial, sans-serif',
    bodyFont: string = 'Arial, sans-serif'
  ): string {
    if (recs.length === 0) return ''

    const cardsHtml = recs.map(rec => this.renderCard(rec, issueId, primaryColor, bodyFont)).join('')

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
            <table width="100%" cellpadding="0" cellspacing="0">
              ${cardsHtml}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  }

  /**
   * Render a single recommendation card
   */
  private static renderCard(rec: RecCard, issueId: string, primaryColor: string, bodyFont: string): string {
    const name = this.escapeHtml(rec.publication_name)
    const desc = this.escapeHtml(rec.description || '')
    const initial = rec.publication_name.charAt(0).toUpperCase()
    const subscribeUrl = `${BASE_URL}/api/sparkloop/module-subscribe?email={$email}&ref_code=${encodeURIComponent(rec.ref_code)}&issue_id=${encodeURIComponent(issueId)}`

    const logoHtml = rec.publication_logo
      ? `<img src="${rec.publication_logo}" alt="${name}" width="48" height="48" style="border-radius: 8px; display: block;" />`
      : `<div style="width: 48px; height: 48px; border-radius: 8px; background-color: ${primaryColor}; color: #fff; font-size: 20px; font-weight: 700; line-height: 48px; text-align: center;">${initial}</div>`

    return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="60" valign="top" style="padding-right: 12px;">
                  ${logoHtml}
                </td>
                <td valign="middle" style="padding-right: 12px;">
                  <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold; color: #333; font-family: ${bodyFont};">${name}</p>
                  <p style="margin: 0; font-size: 14px; color: #666; line-height: 24px; font-family: ${bodyFont};">${desc}</p>
                </td>
                <td width="100" valign="middle" align="right">
                  <a href="${subscribeUrl}" style="display: inline-block; padding: 8px 16px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; text-align: center; font-family: ${bodyFont};">Subscribe</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
