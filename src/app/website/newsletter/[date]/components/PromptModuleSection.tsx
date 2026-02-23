interface PromptModuleSectionProps {
  promptModule: {
    module_name: string
    block_order?: string[]
    prompt: {
      title?: string
      prompt_text?: string
    } | null
  }
}

export default function PromptModuleSection({ promptModule }: PromptModuleSectionProps) {
  const prompt = promptModule.prompt
  if (!prompt) return null

  const blockOrder: string[] = promptModule.block_order || ['title', 'body']

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{promptModule.module_name}</h2>
      <div className="p-6 sm:p-8">
        <div className="text-center">
          {blockOrder.map((blockType: string) => {
            switch (blockType) {
              case 'title':
                return prompt.title ? (
                  <div key="title" className="text-xl font-bold text-slate-900 mb-4">{prompt.title}</div>
                ) : null
              case 'body':
                return prompt.prompt_text ? (
                  <div key="body" className="bg-black text-white p-4 rounded-md font-mono text-sm leading-relaxed whitespace-pre-wrap border-2 border-gray-800 text-left">
                    {prompt.prompt_text}
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
