interface AiAppModuleSectionProps {
  aiAppModule: {
    module_name: string
    block_order?: string[]
    apps: Array<{
      id?: string
      app_name: string
      app_url?: string
      description?: string
      category?: string
    }>
  }
}

function getAppEmoji(app: { category?: string }): string {
  const category = (app.category || '').toLowerCase()
  if (category.includes('accounting') || category.includes('bookkeeping')) return '\uD83D\uDCCA'
  if (category.includes('tax') || category.includes('compliance')) return '\uD83D\uDCCB'
  if (category.includes('payroll')) return '\uD83D\uDCB0'
  if (category.includes('finance') || category.includes('analysis')) return '\uD83D\uDCC8'
  if (category.includes('expense')) return '\uD83E\uDDFE'
  if (category.includes('client')) return '\uD83E\uDD1D'
  if (category.includes('productivity')) return '\u26A1'
  if (category.includes('hr') || category.includes('human')) return '\uD83D\uDC65'
  if (category.includes('banking') || category.includes('payment')) return '\uD83C\uDFE6'
  return '\u2728'
}

export default function AiAppModuleSection({ aiAppModule }: AiAppModuleSectionProps) {
  const apps = aiAppModule.apps
  if (!apps || apps.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{aiAppModule.module_name}</h2>
      <div className="px-4 sm:px-6 py-2">
        {apps.map((app, index: number) => (
          <p key={app.id || index} className="py-3 text-base leading-relaxed">
            <span className="font-bold">{index + 1}.</span> {getAppEmoji(app)}{' '}
            {app.app_url ? (
              <a
                href={app.app_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="text-red-600 hover:text-red-700 underline font-bold"
              >
                {app.app_name}
              </a>
            ) : (
              <span className="font-bold text-slate-900">{app.app_name}</span>
            )}{' '}
            <span className="text-slate-800">{app.description || ''}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
