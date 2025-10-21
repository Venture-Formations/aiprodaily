export function Footer() {
  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-[#1c293d] text-white">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#a855f7] via-[#06b6d4] to-[#14b8a6] flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="font-bold text-base">AI Accounting Daily</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              Empowering accountants and finance professionals with daily AI insights, tools, and strategies.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/newsletters" className="hover:text-white transition-colors">
                  Newsletter
                </a>
              </li>
              <li>
                <a href="#testimonials" className="hover:text-white transition-colors">
                  Testimonials
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
          <p>© 2025 AI Accounting Daily. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
