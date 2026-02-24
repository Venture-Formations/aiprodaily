interface AdModuleSectionProps {
  adModule: {
    module_name: string
    block_order?: string[]
    ad: {
      title?: string
      image_url?: string
      body?: string
      button_url?: string
      button_text?: string
    } | null
    advertiser?: {
      company_name?: string
    }
  }
}

export default function AdModuleSection({ adModule }: AdModuleSectionProps) {
  const ad = adModule.ad
  if (!ad) return null

  const blockOrder: string[] = adModule.block_order || ['title', 'image', 'body', 'button']

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{adModule.module_name}</h2>
      <div className="p-6 sm:p-8">
        <div className="text-center">
          {blockOrder.map((blockType: string) => {
            switch (blockType) {
              case 'title':
                return ad.title ? (
                  <h3 key="title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{ad.title}</h3>
                ) : null
              case 'image':
                if (!ad.image_url) return null
                return ad.button_url ? (
                  <div key="image" className="mb-4">
                    <a href={ad.button_url} target="_blank" rel="noopener noreferrer sponsored">
                      <img
                        src={ad.image_url}
                        alt={ad.title || adModule.module_name}
                        className="mx-auto max-w-full rounded-lg hover:opacity-90 transition-opacity"
                        style={{ maxHeight: '400px' }}
                      />
                    </a>
                  </div>
                ) : (
                  <div key="image" className="mb-4">
                    <img
                      src={ad.image_url}
                      alt={ad.title || adModule.module_name}
                      className="mx-auto max-w-full rounded-lg"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                )
              case 'body':
                return ad.body ? (
                  <div
                    key="body"
                    className="text-slate-900 leading-relaxed text-left prose prose-sm max-w-none mb-4 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: ad.body }}
                  />
                ) : null
              case 'button':
                return ad.button_url ? (
                  <div key="button" className="mt-4">
                    <a
                      href={ad.button_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {ad.button_text || 'Learn More'}
                    </a>
                  </div>
                ) : null
              default:
                return null
            }
          })}
          {adModule.advertiser?.company_name && (
            <div className="mt-4 text-xs text-slate-500">
              Sponsored by {adModule.advertiser.company_name}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
