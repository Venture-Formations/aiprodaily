import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Features } from "@/components/website/features"
import { Newsletter } from "@/components/website/newsletter"
import { Testimonials } from "@/components/website/testimonials"
import { Footer } from "@/components/website/footer"
import { supabaseAdmin } from "@/lib/supabase"

export default async function WebsiteHome() {
  // Fetch header image from settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .eq('key', 'header_image_url')
    .single()

  const headerImageUrl = settings?.value || '/logo.png'

  return (
    <main className="min-h-screen">
      <Header logoUrl={headerImageUrl} />
      <Hero />
      <Features />
      <Newsletter />
      <Testimonials />
      <Footer />
    </main>
  )
}
