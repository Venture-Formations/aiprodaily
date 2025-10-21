import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Footer } from "@/components/website/footer"
import { supabaseAdmin } from "@/lib/supabase"

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function WebsiteHome() {
  // Fetch header image from settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .eq('key', 'website_header_url')
    .single()

  const headerImageUrl = settings?.value || '/logo.png'

  return (
    <main className="min-h-screen">
      <Header logoUrl={headerImageUrl} />
      <Hero />
      {/* Content area for visual separation */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F5F7] min-h-[400px]">
        <div className="container mx-auto max-w-6xl">
          {/* Content will go here */}
        </div>
      </section>
      <Footer />
    </main>
  )
}
