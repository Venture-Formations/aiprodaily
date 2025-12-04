import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Newspaper, Calendar, Eye, MousePointer } from 'lucide-react'
import { AdCard } from '../components/AdCard'

export const dynamic = 'force-dynamic'

export default async function NewsletterAdsPage() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's newsletter advertisements
  const { data: ads } = await supabaseAdmin
    .from('advertisements')
    .select('*')
    .eq('clerk_user_id', user.id)
    .eq('ad_type', 'main_sponsor')
    .order('created_at', { ascending: false })

  const hasAds = ads && ads.length > 0

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Ads</h1>
          <p className="text-gray-600 mt-1">
            Reach thousands of subscribers with Main Sponsor placements
          </p>
        </div>
        <Link
          href="/account/ads/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Create New Ad
        </Link>
      </div>

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

        {hasAds ? (
          <div className="divide-y divide-gray-100">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No newsletter ads yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create your first newsletter ad to reach thousands of accounting professionals with your message.
            </p>
            <Link
              href="/account/ads/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1c293d] text-white rounded-lg font-medium hover:bg-[#1c293d]/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Main Sponsor Ad
            </Link>
          </div>
        )}
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
  )
}

