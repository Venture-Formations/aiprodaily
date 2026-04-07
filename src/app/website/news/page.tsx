import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { fetchNewsPageData, formatNewsDate, buildQueryString, type NewsItem } from './news-helpers'

export const metadata: Metadata = {
  title: 'News - AI Accounting Daily',
  description: 'Browse all articles and newsletters from AI Accounting Daily'
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Link
      href={item.type === 'newsletter' ? `/newsletter/${item.slug}` : `/news/${item.slug}`}
      className="group block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
    >
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-white text-4xl font-bold opacity-50">{item.type === 'newsletter' ? 'NL' : 'A'}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className={`px-2 py-1 text-xs font-semibold rounded ${item.type === 'newsletter' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{item.category}</span>
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span>{formatNewsDate(item.date)}</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 mb-3 flex-1">{item.title}</h3>
        {item.type === 'newsletter' && item.metadata && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {((item.metadata.total_articles || 0) + (item.metadata.total_secondary_articles || 0)) > 0 && (
              <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>{(item.metadata.total_articles || 0) + (item.metadata.total_secondary_articles || 0)} articles</span>
            )}
            {item.metadata.has_ai_apps && <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>AI Apps</span>}
            {item.metadata.has_prompt && <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>AI Prompt</span>}
          </div>
        )}
        {item.type === 'article' && item.description && <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>}
      </div>
    </Link>
  )
}

export default async function NewsArchivePage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; from?: string; to?: string; page?: string }>
}) {
  const params = await searchParams
  const data = await fetchNewsPageData(params)

  return (
    <div className="min-h-screen bg-white">
      <Header logoUrl={data.headerImageUrl} showToolsLink={data.showToolsLink} />

      <section className="relative overflow-hidden bg-blue-600 pt-16 pb-12">
        <img src="/images/background-call-to-action.jpg" alt="" className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2" width={2347} height={1244} />
        <Container className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">News</h1>
            <p className="mt-4 text-lg tracking-tight text-blue-100">Browse all articles and newsletters from {data.newsletterName}</p>
          </div>
        </Container>
      </section>

      <main>
        <Container className="py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              {data.paginatedItems.length === 0 ? (
                <div className="text-center py-16"><p className="text-gray-500 text-lg">No articles found matching your criteria</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {data.paginatedItems.map((item) => <NewsCard key={`${item.type}-${item.slug}`} item={item} />)}
                </div>
              )}

              {data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {data.currentPage > 1 && <Link href={`/news${buildQueryString(data.params, data.currentPage - 1)}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Previous</Link>}
                  {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (data.totalPages <= 5) pageNum = i + 1
                    else if (data.currentPage <= 3) pageNum = i + 1
                    else if (data.currentPage >= data.totalPages - 2) pageNum = data.totalPages - 4 + i
                    else pageNum = data.currentPage - 2 + i
                    return <Link key={pageNum} href={`/news${buildQueryString(data.params, pageNum)}`} className={`px-4 py-2 rounded ${data.currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{pageNum}</Link>
                  })}
                  {data.currentPage < data.totalPages && <Link href={`/news${buildQueryString(data.params, data.currentPage + 1)}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Next</Link>}
                </div>
              )}
            </div>

            <div className="lg:w-64 flex-shrink-0">
              <div className="bg-gray-50 rounded-lg p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
                <ul className="space-y-1">
                  <li><Link href="/news" className={`block px-3 py-2 rounded-md transition-colors ${!data.params.category ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>All</Link></li>
                  <li><Link href="/news?category=newsletter" className={`block px-3 py-2 rounded-md transition-colors ${data.params.category === 'newsletter' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>Newsletter</Link></li>
                  {data.categories.map(cat => (
                    <li key={cat.id}><Link href={`/news?category=${cat.slug}`} className={`block px-3 py-2 rounded-md transition-colors ${data.params.category === cat.slug ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>{cat.name}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </main>

      <Footer logoUrl={data.logoUrl} newsletterName={data.newsletterName} businessName={data.businessName} currentYear={data.currentYear} showToolsLink={data.showToolsLink} />
    </div>
  )
}
