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
    issueId: string
  ): string {
    if (recs.length === 0) return ''

    const cardsHtml = recs.map(rec => this.renderCard(rec, issueId)).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin: 10px auto; max-width: 750px; background-color: #ffffff; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 24px 20px 8px 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center;">${sectionName}</h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; text-align: center;">Curated newsletters we think you'll love</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 20px 24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${cardsHtml}
      </table>
    </td>
  </tr>
</table>
<br>`
  }

  /**
   * Render a single recommendation card
   */
  private static renderCard(rec: RecCard, issueId: string): string {
    const name = this.escapeHtml(rec.publication_name)
    const desc = this.escapeHtml(this.truncate(rec.description || '', 120))
    const initial = rec.publication_name.charAt(0).toUpperCase()
    const subscribeUrl = `${BASE_URL}/api/sparkloop/module-subscribe?email={$email}&ref_code=${encodeURIComponent(rec.ref_code)}&issue_id=${encodeURIComponent(issueId)}`

    // Logo: use image if available, otherwise initial circle
    const logoHtml = rec.publication_logo
      ? `<img src="${rec.publication_logo}" alt="${name}" width="44" height="44" style="border-radius: 50%; display: block;" />`
      : `<div style="width: 44px; height: 44px; border-radius: 50%; background-color: #6366f1; color: #fff; font-size: 20px; font-weight: 700; line-height: 44px; text-align: center;">${initial}</div>`

    return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="56" valign="top" style="padding-right: 12px;">
                  ${logoHtml}
                </td>
                <td valign="middle" style="padding-right: 12px;">
                  <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${name}</p>
                  <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.4;">${desc}</p>
                </td>
                <td width="100" valign="middle" align="right">
                  <a href="${subscribeUrl}" style="display: inline-block; padding: 8px 16px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; text-align: center;">Subscribe</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
  }

  private static truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen - 3).trimEnd() + '...'
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
