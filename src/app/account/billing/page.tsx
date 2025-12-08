import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CreditCard, ExternalLink, FileText, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // In production, you would create a Stripe portal session here
  // and redirect the user to it
  const stripePortalUrl = '/api/account/billing/portal'

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-600 mt-1">
          Manage your subscriptions and payment methods
        </p>
      </div>

      {/* Billing Portal Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-xl mx-auto">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-50 flex items-center justify-center">
          <CreditCard className="w-8 h-8 text-blue-600" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-3">
          Manage Your Billing
        </h2>
        <p className="text-slate-600 mb-8">
          View invoices, update payment methods, and manage your subscriptions through our secure billing portal powered by Stripe.
        </p>

        <a
          href={stripePortalUrl}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-700 transition-colors"
        >
          Open Billing Portal
          <ExternalLink className="w-5 h-5" />
        </a>

        {/* Features List */}
        <div className="mt-10 pt-8 border-t border-slate-200">
          <div className="grid grid-cols-3 gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Invoices</p>
                <p className="text-xs text-slate-500">View & download</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Payment</p>
                <p className="text-xs text-slate-500">Update card info</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">Subscriptions</p>
                <p className="text-xs text-slate-500">Manage plans</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

