import { currentUser } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Calendar, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { ApproveButton } from './components/ApproveButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const statusConfig = {
  pending_payment: {
    label: 'Awaiting Payment',
    color: 'bg-amber-100 text-amber-800',
    icon: Clock,
  },
  pending_review: {
    label: 'Submitted - Under Review',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
  },
  in_progress: {
    label: 'Being Created',
    color: 'bg-purple-100 text-purple-800',
    icon: Clock,
  },
  awaiting_approval: {
    label: 'Ready for Your Approval',
    color: 'bg-cyan-100 text-cyan-800',
    icon: AlertCircle,
  },
  approved: {
    label: 'Scheduled',
    color: 'bg-emerald-100 text-emerald-800',
    icon: Calendar,
  },
  active: {
    label: 'Running',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  completed: {
    label: 'Sent',
    color: 'bg-gray-100 text-gray-800',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
}

export default async function AdDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Fetch the ad
  const { data: ad, error } = await supabaseAdmin
    .from('advertisements')
    .select('*')
    .eq('id', id)
    .eq('clerk_user_id', user.id)
    .single()

  if (error || !ad) {
    notFound()
  }

  const status = statusConfig[ad.status as keyof typeof statusConfig] || statusConfig.pending_review
  const StatusIcon = status.icon

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/account/ads"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Ads
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ad.company_name || ad.title}</h1>
            <p className="text-gray-600 mt-1">Main Sponsor Advertisement</p>
          </div>
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Approval Section (if awaiting_approval) */}
          {ad.status === 'awaiting_approval' && ad.preview_image_url && (
            <div className="bg-gradient-to-r from-[#06b6d4]/10 to-[#14b8a6]/10 border border-[#06b6d4]/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview Ready for Approval</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <img
                  src={ad.preview_image_url}
                  alt="Ad Preview"
                  className="w-full rounded-lg"
                />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Review the ad preview above. If it looks good, click approve to confirm. Your ad will be scheduled for {formatDate(ad.preferred_start_date)}.
              </p>
              <div className="flex gap-3">
                <ApproveButton adId={ad.id} />
                <a
                  href="/contactus"
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Request Changes
                </a>
              </div>
            </div>
          )}

          {/* Ad Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ad Content</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Company/Product</label>
                <p className="text-gray-900 mt-1">{ad.company_name || '—'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Headline</label>
                <p className="text-gray-900 mt-1">{ad.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <div 
                  className="text-gray-900 mt-1 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: ad.body }}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Destination URL</label>
                <a 
                  href={ad.button_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#06b6d4] hover:underline mt-1"
                >
                  {ad.button_url}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Button Text</label>
                <p className="text-gray-900 mt-1">{ad.button_text}</p>
              </div>
            </div>
          </div>

          {/* Submitted Image */}
          {ad.image_url && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Submitted Image</h2>
              <img
                src={ad.image_url}
                alt="Submitted"
                className="rounded-lg border border-gray-200 max-w-sm"
              />
            </div>
          )}

          {/* Rejection Reason */}
          {ad.status === 'rejected' && ad.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Rejection Reason</h2>
              <p className="text-red-700">{ad.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Schedule Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Schedule</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requested Date</label>
                <p className="text-gray-900 mt-1">{formatDate(ad.preferred_start_date)}</p>
              </div>
              {ad.actual_start_date && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Confirmed Date</label>
                  <p className="text-gray-900 mt-1">{formatDate(ad.actual_start_date)}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ad Type</label>
                <p className="text-gray-900 mt-1">
                  {ad.ad_type === 'main_sponsor' ? 'Main Sponsor' : ad.ad_type || 'Newsletter'}
                </p>
              </div>
              {ad.frequency === 'weekly' && ad.paid === true && ad.times_paid && ad.times_paid > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weeks Remaining</label>
                  <p className="text-gray-900 mt-1">
                    {Math.max(0, ad.times_paid - (ad.times_used || 0))} of {ad.times_paid}
                    {Math.max(0, ad.times_paid - (ad.times_used || 0)) <= 2 && Math.max(0, ad.times_paid - (ad.times_used || 0)) > 0 && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                        Low
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</label>
                <p className="text-gray-900 mt-1">
                  {ad.payment_amount ? `$${(ad.payment_amount / 100).toFixed(2)}` : 'TBD'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <p className="text-gray-900 mt-1 capitalize">{ad.payment_status || 'Pending'}</p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted</span>
                <span className="text-gray-900">{new Date(ad.created_at).toLocaleDateString()}</span>
              </div>
              {ad.approved_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Approved</span>
                  <span className="text-gray-900">{new Date(ad.approved_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

