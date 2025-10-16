import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <div className="flex items-center h-full">
            <img src="/logo.png" alt="AI Accounting Daily" className="h-12 object-contain" />
          </div>

          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#newsletter"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Newsletter
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </a>
          </nav>

          <Button className="bg-[#1c293d] hover:bg-[#1c293d]/90 text-white">Subscribe</Button>
        </div>
      </div>
    </header>
  )
}
