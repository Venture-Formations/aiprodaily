interface AdvertorialSectionProps {
  advertorial: {
    title: string
    image_url?: string
    body: string
    button_url?: string
    cta_text?: string
  }
}

export default function AdvertorialSection({ advertorial }: AdvertorialSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">Presented By</h2>
      <div className="p-6 sm:p-8">
        <div className="text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{advertorial.title}</h3>
          {advertorial.image_url && advertorial.button_url ? (
            <div className="mb-4">
              <a href={advertorial.button_url} target="_blank" rel="noopener noreferrer sponsored">
                <img
                  src={advertorial.image_url}
                  alt={advertorial.title}
                  className="mx-auto max-w-full rounded-lg hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '400px' }}
                />
              </a>
            </div>
          ) : advertorial.image_url ? (
            <div className="mb-4">
              <img
                src={advertorial.image_url}
                alt={advertorial.title}
                className="mx-auto max-w-full rounded-lg"
                style={{ maxHeight: '400px' }}
              />
            </div>
          ) : null}
          <div
            className="text-slate-900 leading-relaxed text-left prose prose-sm max-w-none [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-none [&_ol]:pl-0 [&_li]:mb-1 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"
            dangerouslySetInnerHTML={{ __html: advertorial.body }}
          />
          {advertorial.cta_text && advertorial.button_url && advertorial.button_url !== '#' && (
            <div className="mt-2">
              <a href={advertorial.button_url} target="_blank" rel="noopener noreferrer sponsored" className="underline font-bold text-slate-900">
                {advertorial.cta_text}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
