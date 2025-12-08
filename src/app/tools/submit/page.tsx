import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { SubmitToolForm } from './submit-form'
import { getApprovedCategories } from '@/lib/directory'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'

export const dynamic = 'force-dynamic'

export default async function SubmitToolPage() {
  const categories = await getApprovedCategories()

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
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-8">
            <SubmitToolForm categories={categories} />
          </div>

          {/* Pricing Info */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-medium tracking-tight text-slate-900 text-center mb-8">
              Listing Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Free Listing</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">$0</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Basic listing
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

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-sm ring-2 ring-blue-500 p-6 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Popular
                </span>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Monthly Sponsor</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">$30</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
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
                      &quot;Sponsored&quot; badge
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Priority placement
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-900">Yearly Sponsor</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">$250</span>
                    <span className="text-slate-500">/year</span>
                  </div>
                  <p className="text-sm text-green-600 font-medium mt-1">Save $110/year</p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Everything in Monthly
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Newsletter feature
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Best value
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </SignedIn>
      </Container>
    </section>
  )
}
