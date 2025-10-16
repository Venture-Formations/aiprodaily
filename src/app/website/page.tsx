import { Header } from "@/components/website/header"
import { Hero } from "@/components/website/hero"
import { Features } from "@/components/website/features"
import { Newsletter } from "@/components/website/newsletter"
import { Testimonials } from "@/components/website/testimonials"
import { Footer } from "@/components/website/footer"

export default function WebsiteHome() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Newsletter />
      <Testimonials />
      <Footer />
    </main>
  )
}
