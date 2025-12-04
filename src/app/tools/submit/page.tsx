import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { SubmitToolForm } from './submit-form'
import { getApprovedCategories } from '@/lib/directory'

export const dynamic = 'force-dynamic'

export default async function SubmitToolPage() {
  const categories = await getApprovedCategories()

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">Submit Your AI Tool</h1>
        <p className="mt-4 text-lg text-gray-600">
          Share your AI tool with thousands of accounting professionals.
          Get visibility and drive traffic to your product.
        </p>
      </div>

      <SignedOut>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#a855f7]/20 via-[#06b6d4]/20 to-[#14b8a6]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#06b6d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to Submit</h2>
          <p className="text-gray-600 mb-6">
            Create a free account to submit your tool and track its status.
          </p>
          <SignInButton mode="modal">
            <button className="bg-[#1c293d] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#1c293d]/90 transition-colors">
              Sign In to Continue
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <SubmitToolForm categories={categories} />
        </div>

        {/* Pricing Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Free Listing</h3>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">$0</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Basic listing
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Category placement
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Search visibility
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#a855f7]/5 via-[#06b6d4]/5 to-[#14b8a6]/5 rounded-xl shadow-sm border-2 border-[#06b6d4] p-6 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] text-white text-xs font-semibold px-3 py-1 rounded-full">
              Popular
            </span>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Sponsor</h3>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">$30</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#06b6d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Everything in Free
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#06b6d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  "Sponsored" badge
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#06b6d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Priority placement
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Yearly Sponsor</h3>
              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">$250</span>
                <span className="text-gray-500">/year</span>
              </div>
              <p className="text-sm text-green-600 font-medium mt-1">Save $110/year</p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Everything in Monthly
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Newsletter feature
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Best value
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SignedIn>
    </div>
  )
}
