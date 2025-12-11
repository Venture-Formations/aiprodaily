import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { SubmitToolForm } from './submit-form'
import { getApprovedCategories, getCategoriesWithFeaturedTools } from '@/lib/directory'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'

export const dynamic = 'force-dynamic'

// Pricing constants
const PAID_PLACEMENT_MONTHLY = 30
const FEATURED_MONTHLY = 60 // Double the paid placement price
const YEARLY_DISCOUNT_MONTHS = 2 // 2 months free

export default async function SubmitToolPage() {
  const [categories, categoriesWithFeatured] = await Promise.all([
    getApprovedCategories(),
    getCategoriesWithFeaturedTools()
  ])

  // Convert Set to array for client component
  const featuredCategories = Array.from(categoriesWithFeatured)

  return (
    <section className="py-16">
      <Container>
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">
            Submit Your AI Tool
          </h1>
          <p className="mt-4 text-lg tracking-tight text-slate-700 max-w-2xl mx-auto">
            Share your AI tool with thousands of accounting professionals.
            Get visibility and drive traffic to your product.
          </p>
        </div>

        <SignedOut>
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Sign in to Submit</h2>
            <p className="text-slate-600 mb-6">
              Create a free account to submit your tool and track its status.
            </p>
            <SignInButton mode="modal">
              <Button color="blue">
                Sign In to Continue
              </Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Pricing Info - Show above form */}
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900 text-center mb-8">
              Listing Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free Listing */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Free Listing</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">$0</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600 text-left">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Basic directory listing
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Category placement
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Search visibility
                    </li>
                  </ul>
                </div>
              </div>

              {/* Paid Placement */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-sm ring-2 ring-blue-500 p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Popular
                </span>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Paid Placement</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">${PAID_PLACEMENT_MONTHLY}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    or ${PAID_PLACEMENT_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)}/year
                    <span className="text-green-600 font-medium ml-1">(Save ${PAID_PLACEMENT_MONTHLY * YEARLY_DISCOUNT_MONTHS})</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600 text-left">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Everything in Free
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Page 1 placement in category
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Priority in search results
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      &quot;Paid Placement&quot; disclosure
                    </li>
                  </ul>
                </div>
              </div>

              {/* Featured Listing */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm ring-2 ring-amber-500 p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Premium
                </span>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Featured Listing</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">${FEATURED_MONTHLY}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    or ${FEATURED_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)}/year
                    <span className="text-green-600 font-medium ml-1">(Save ${FEATURED_MONTHLY * YEARLY_DISCOUNT_MONTHS})</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600 text-left">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Everything in Paid Placement
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      #1 position in category
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      &quot;Featured&quot; badge
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Highlighted card design
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                    Limited to 1 per category
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-8">
            <SubmitToolForm
              categories={categories}
              featuredCategories={featuredCategories}
              pricing={{
                paidPlacementMonthly: PAID_PLACEMENT_MONTHLY,
                featuredMonthly: FEATURED_MONTHLY,
                yearlyDiscountMonths: YEARLY_DISCOUNT_MONTHS
              }}
            />
          </div>
        </SignedIn>
      </Container>
    </section>
  )
}
