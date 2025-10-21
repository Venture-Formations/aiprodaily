import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { supabaseAdmin } from "@/lib/supabase"

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function WebsiteHome() {
  // Fetch header image from settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .eq('key', 'header_image_url')
    .single()

  const headerImageUrl = settings?.value || '/logo.png'

  return (
    <main className="min-h-screen flex flex-col">
      <Header logoUrl={headerImageUrl} />
      <div className="flex-grow"></div>
      <Footer />
    </main>
  )
}
