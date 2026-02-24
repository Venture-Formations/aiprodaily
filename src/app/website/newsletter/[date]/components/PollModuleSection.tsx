interface PollModuleSectionProps {
  pollModule: {
    module_name: string
    block_order?: string[]
    poll: {
      title?: string
      question?: string
      image_url?: string
      options?: string[]
    } | null
  }
}

export default function PollModuleSection({ pollModule }: PollModuleSectionProps) {
  const modulePoll = pollModule.poll
  if (!modulePoll) return null

  const blockOrder: string[] = pollModule.block_order || ['title', 'question', 'image', 'options']

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-purple-600 text-white">{pollModule.module_name}</h2>
      <div className="p-6 sm:p-8">
        <div className="text-center">
          {blockOrder.map((blockType: string) => {
            switch (blockType) {
              case 'title':
                return modulePoll.title ? (
                  <h3 key="title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{modulePoll.title}</h3>
                ) : null
              case 'question':
                return modulePoll.question ? (
                  <div key="question" className="text-lg text-slate-700 mb-4">{modulePoll.question}</div>
                ) : null
              case 'image':
                if (!modulePoll.image_url) return null
                return (
                  <div key="image" className="mb-4">
                    <img
                      src={modulePoll.image_url}
                      alt={modulePoll.title || pollModule.module_name}
                      className="mx-auto max-w-full rounded-lg"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                )
              case 'options':
                return modulePoll.options && modulePoll.options.length > 0 ? (
                  <div key="options" className="mt-4">
                    <div className="text-sm text-slate-500 mb-2">Poll options:</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {modulePoll.options.map((option: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      This poll was available in the email newsletter.
                    </div>
                  </div>
                ) : null
              default:
                return null
            }
          })}
        </div>
      </div>
    </div>
  )
}
