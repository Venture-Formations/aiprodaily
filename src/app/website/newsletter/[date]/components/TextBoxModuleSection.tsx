interface TextBoxModuleSectionProps {
  textBoxModule: {
    module_id: string
    module_name: string
    show_name?: boolean
    blocks: Array<{
      id?: string
      block_type: 'static_text' | 'ai_prompt' | 'image'
      static_content?: string
      generated_content?: string
      static_image_url?: string
      generated_image_url?: string
      text_size?: string
    }>
  }
  cleanMergeTags: (text: string) => string
}

function getTextSizeClass(size: string) {
  switch (size) {
    case 'small': return 'text-sm'
    case 'large': return 'text-xl font-semibold'
    default: return 'text-base'
  }
}

export default function TextBoxModuleSection({ textBoxModule, cleanMergeTags }: TextBoxModuleSectionProps) {
  const blocks = textBoxModule.blocks || []
  if (blocks.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      {textBoxModule.show_name && (
        <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{textBoxModule.module_name}</h2>
      )}
      <div className="p-6 sm:p-8">
        <div className="space-y-4">
          {blocks.map((block, index: number) => {
            // Get content based on block type
            let content = ''
            if (block.block_type === 'static_text') {
              content = block.static_content || ''
            } else if (block.block_type === 'ai_prompt') {
              content = block.generated_content || ''
            }

            // Clean merge tags for website display
            if (content) {
              content = cleanMergeTags(content)
            }

            // Render based on block type
            if (block.block_type === 'image') {
              const imageUrl = block.static_image_url || block.generated_image_url
              if (!imageUrl) return null
              return (
                <div key={block.id || index} className="text-center">
                  <img
                    src={imageUrl}
                    alt=""
                    className="max-w-full h-auto rounded-lg mx-auto"
                  />
                </div>
              )
            }

            // Text content (static or AI-generated)
            if (!content) return null
            return (
              <div
                key={block.id || index}
                className={`${getTextSizeClass(block.text_size || 'medium')} text-slate-900/80 leading-relaxed`}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
