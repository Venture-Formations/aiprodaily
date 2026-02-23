interface ArticleModuleSectionProps {
  articleModule: {
    module_name: string
    block_order?: string[]
    articles: Array<{
      id: string
      headline: string
      content: string
      ai_image_url?: string
      rss_post?: {
        source_url?: string
        image_url?: string
      }
    }>
  }
}

export default function ArticleModuleSection({ articleModule }: ArticleModuleSectionProps) {
  const moduleArticles = articleModule.articles
  if (!moduleArticles || moduleArticles.length === 0) return null

  const blockOrder: string[] = articleModule.block_order || ['title', 'body']

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{articleModule.module_name}</h2>
      <div className="p-6 sm:p-8">
        <div className="space-y-8">
          {moduleArticles.map((article, index: number) => (
            <article key={article.id} className="border-b border-slate-200 last:border-0 pb-8 last:pb-0">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  {blockOrder.map((blockType: string) => {
                    switch (blockType) {
                      case 'source_image':
                        return article.rss_post?.image_url ? (
                          <div key="source_image" className="mb-4">
                            <img
                              src={article.rss_post.image_url}
                              alt={article.headline}
                              className="w-full max-w-md rounded-lg"
                            />
                          </div>
                        ) : null
                      case 'ai_image':
                        return article.ai_image_url ? (
                          <div key="ai_image" className="mb-4">
                            <img
                              src={article.ai_image_url}
                              alt={article.headline}
                              className="w-full max-w-md rounded-lg"
                            />
                          </div>
                        ) : null
                      case 'title':
                        return (
                          <h3 key="title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                            {article.headline}
                          </h3>
                        )
                      case 'body':
                        return (
                          <div key="body" className="text-slate-900/80 leading-relaxed mb-4 whitespace-pre-wrap">
                            {article.content}
                          </div>
                        )
                      default:
                        return null
                    }
                  })}

                  {article.rss_post?.source_url && (
                    <a
                      href={article.rss_post.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium inline-flex items-center gap-1"
                    >
                      Read full story
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
