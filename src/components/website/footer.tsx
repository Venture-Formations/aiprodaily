import { supabaseAdmin } from "@/lib/supabase"

export async function Footer() {
  // Fetch business settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['logo_url', 'newsletter_name', 'business_name'])

  const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
  const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'AI Accounting Daily'
  const businessName = settings?.find(s => s.key === 'business_name')?.value || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-[#1c293d] text-white">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoUrl} alt={newsletterName} className="w-8 h-8 object-contain" />
              <span className="font-bold text-base">{newsletterName}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              Empowering accountants and finance professionals with daily AI insights, tools, and strategies.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <a href="/" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/newsletters" className="hover:text-white transition-colors">
                  Newsletter
                </a>
              </li>
              <li>
                <a href="/newsletters" className="hover:text-white transition-colors">
                  Archive
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Legal</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-center text-white/60 text-xs">
          <p>© {currentYear} {businessName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
