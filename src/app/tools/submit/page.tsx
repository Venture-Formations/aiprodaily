import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { SubmitToolForm } from './submit-form'
import { getApprovedCategories, getCategoriesWithFeaturedTools, getDirectoryPricing } from '@/lib/directory'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'

export const dynamic = 'force-dynamic'

export default async function SubmitToolPage() {
  const [categories, categoriesWithFeatured, pricing] = await Promise.all([
    getApprovedCategories(),
    getCategoriesWithFeaturedTools(),
    getDirectoryPricing()
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
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-8">
            <SubmitToolForm
              categories={categories}
              featuredCategories={featuredCategories}
              featuredMonthlyPrice={pricing.featuredPrice}
            />
          </div>
        </SignedIn>
      </Container>
    </section>
  )
}
