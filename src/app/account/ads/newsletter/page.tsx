import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Newspaper, Calendar, Eye, MousePointer, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewsletterAdsPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Newsletter Ads</h1>
        <p className="text-gray-600 mt-1">
          Reach thousands of subscribers with Main Sponsor placements
        </p>
      </div>

      {/* Coming Soon Overlay Section */}
      <div className="relative">
        {/* Coming Soon Badge */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-purple-100 to-cyan-100 flex items-center justify-center">
              <Clock className="w-8 h-8 text-cyan-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Coming Soon</h2>
            <p className="text-slate-600 mb-4">
              Newsletter advertising will be available soon. We&apos;re working on bringing you the best way to reach thousands of accounting professionals.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
              <Clock className="w-4 h-4" />
              Stay tuned for updates
            </div>
          </div>
        </div>

        {/* Grayed out content behind */}
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {/* Newsletter Ads Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#a855f7]/10 via-[#06b6d4]/10 to-[#14b8a6]/10 flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-[#06b6d4]" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Main Sponsor Ads</h2>
                  <p className="text-sm text-gray-500">Advertorial placements in the newsletter</p>
                </div>
              </div>
            </div>

            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No newsletter ads yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Create your first newsletter ad to reach thousands of accounting professionals with your message.
              </p>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1c293d] text-white rounded-lg font-medium">
                Create Main Sponsor Ad
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-8 grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">High Visibility</h3>
              <p className="text-sm text-gray-500">
                Main Sponsor ads appear prominently in each newsletter issue, seen by thousands of subscribers.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center mb-4">
                <MousePointer className="w-6 h-6 text-cyan-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Engaged Audience</h3>
              <p className="text-sm text-gray-500">
                Our readers are accounting professionals actively looking for AI tools and solutions.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Flexible Scheduling</h3>
              <p className="text-sm text-gray-500">
                Choose your preferred date or let us place your ad in the next available slot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

