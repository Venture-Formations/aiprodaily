interface LegacyPromptSectionProps {
  prompt: {
    title?: string
    prompt_text?: string
  }
}

export default function LegacyPromptSection({ prompt }: LegacyPromptSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">Prompt Ideas</h2>
      <div className="p-6 sm:p-8">
        {prompt.title && (
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{prompt.title}</h3>
        )}
        {prompt.prompt_text && (
          <div className="mx-auto bg-black text-white p-4 rounded-lg font-mono leading-relaxed whitespace-pre-wrap prose prose-sm prose-invert text-left" style={{ maxWidth: '710px' }}>
            {prompt.prompt_text}
          </div>
        )}
      </div>
    </div>
  )
}
