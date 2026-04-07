import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { ExternalLink, MousePointer, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react'
import {
  type AdData,
  checkShowButton,
  fetchIssueIds,
  fetchIssuesWithMetrics,
  fetchAdClicks,
  computeAnalytics,
  formatDate,
} from './ad-analytics-helpers'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ 'ad-id': string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { 'ad-id': adId } = await params
  const { data: ad } = await supabaseAdmin
    .from('advertisements')
    .select('title, company_name')
    .eq('id', adId)
    .single()

  if (!ad) return { title: 'Ad Not Found' }
  return {
    title: `${ad.title} - Ad Analytics`,
    description: `Performance analytics for ${ad.company_name || ad.title} advertisement`
  }
}

export default async function AdAnalyticsPage({ params }: PageProps) {
  const { 'ad-id': adId } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(adId)) notFound()

  const { data: ad, error: adError } = await supabaseAdmin
    .from('advertisements')
    .select('id, title, body, image_url, image_alt, button_text, button_url, cta_text, status, company_name, publication_id, times_used, created_at, ad_module_id')
    .eq('id', adId)
    .single()

  if (adError || !ad) notFound()

  const showButton = await checkShowButton(ad as AdData)
  const issueIds = await fetchIssueIds(adId)
  const issues = await fetchIssuesWithMetrics(issueIds)
  const adClicks = await fetchAdClicks(issueIds, ad.publication_id, ad.button_url)
  const { totalClicks, uniqueClickers, totalRecipients, clickThroughRate, dailyBreakdown, issueBreakdown } = computeAnalytics(adClicks, issues, issueIds)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-semibold text-gray-900">Ad Analytics</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Ad Preview Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-blue-600 px-6 py-3">
            <h1 className="text-xl font-semibold text-white">{ad.company_name || ad.title}</h1>
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{ad.title}</h2>
            {ad.image_url && (
              <div className="mb-4">
                <img src={ad.image_url} alt={ad.image_alt || ad.title} className="w-full max-w-md h-auto rounded-lg border border-gray-200" />
              </div>
            )}
            <div className="prose prose-sm max-w-none text-gray-700 mb-4" dangerouslySetInnerHTML={{ __html: ad.body }} />
            {ad.cta_text && ad.button_url && (
              <div className="mb-4">
                <a href={ad.button_url} target="_blank" rel="noopener noreferrer" className="text-black underline font-bold">{ad.cta_text}</a>
              </div>
            )}
            {showButton && ad.button_url && (
              <a href={ad.button_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {ad.button_text || 'Learn More'} <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-100 rounded-lg"><MousePointer className="w-5 h-5 text-blue-600" /></div><span className="text-sm font-medium text-gray-500">Total Clicks</span></div>
            <p className="text-3xl font-bold text-gray-900">{totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-green-100 rounded-lg"><Users className="w-5 h-5 text-green-600" /></div><span className="text-sm font-medium text-gray-500">Unique Clickers</span></div>
            <p className="text-3xl font-bold text-gray-900">{uniqueClickers.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div><span className="text-sm font-medium text-gray-500">Click-Through Rate</span></div>
            <p className="text-3xl font-bold text-gray-900">{clickThroughRate !== null ? `${clickThroughRate}%` : '\u2014'}</p>
            {totalRecipients > 0 && <p className="text-xs text-gray-500 mt-1">{uniqueClickers.toLocaleString()} of {totalRecipients.toLocaleString()} recipients</p>}
          </div>
        </div>

        {/* Daily Click Breakdown */}
        {dailyBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-semibold text-gray-900">Daily Click Breakdown</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Clicks</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Clickers</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyBreakdown.map((day, idx) => (
                    <tr key={day.date} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(day.date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{day.totalClicks}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{day.uniqueClickers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Issues Table */}
        {issueBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Newsletter Issues</h2>
              <p className="text-sm text-gray-500 mt-1">Ad appeared in {issueBreakdown.length} newsletter{issueBreakdown.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Opened</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Open Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unique</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {issueBreakdown.map((issue, idx) => (
                    <tr key={issue.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(issue.date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{issue.sentCount.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{issue.openedCount.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{issue.openRate !== null ? `${issue.openRate}%` : '\u2014'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{issue.totalClicks}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{issue.uniqueClickers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {issueBreakdown.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Newsletter Data Yet</h3>
            <p className="text-gray-500">This ad hasn&apos;t been sent in any newsletters yet. Analytics will appear here once the ad runs.</p>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-sm text-gray-500 text-center">Ad Analytics Dashboard</p>
        </div>
      </footer>
    </div>
  )
}
