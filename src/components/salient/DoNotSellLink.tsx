'use client'

/**
 * Opens the Google Funding Choices US state regulations (CCPA/CPRA) opt-out dialog.
 * Used when overrideDnsLink is set in layout so the default bar is hidden.
 */
export function DoNotSellLink() {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const gfc = typeof window !== 'undefined' ? (window as unknown as { googlefc?: { usstatesoptout?: { openConfirmationDialog: (cb: (optedOut: boolean) => void) => void } } }).googlefc : undefined
    gfc?.usstatesoptout?.openConfirmationDialog?.(() => {})
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-sm text-slate-500 underline hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 rounded"
    >
      Do Not Sell or Share My Personal Information
    </button>
  )
}
