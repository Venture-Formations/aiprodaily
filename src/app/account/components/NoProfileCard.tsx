import Link from 'next/link'
import { Plus, Sparkles } from 'lucide-react'

export function NoProfileCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
      <div className="max-w-md mx-auto">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-blue-600" />
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          No Listing Yet
        </h2>
        <p className="text-slate-600 mb-8">
          Submit your AI tool to the directory and get discovered by thousands of accounting professionals looking for solutions like yours.
        </p>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-left">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl mb-1">🎯</p>
            <p className="text-sm font-medium text-slate-900">Targeted</p>
            <p className="text-xs text-slate-500">Reach accountants & finance pros</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl mb-1">📈</p>
            <p className="text-sm font-medium text-slate-900">Visibility</p>
            <p className="text-xs text-slate-500">Appear in search & categories</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl mb-1">💰</p>
            <p className="text-sm font-medium text-slate-900">Free</p>
            <p className="text-xs text-slate-500">Basic listings are free</p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/tools/submit"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Submit Your Tool
        </Link>

        <p className="mt-4 text-sm text-slate-500">
          Free listings are reviewed within 1-2 business days
        </p>
      </div>
    </div>
  )
}

