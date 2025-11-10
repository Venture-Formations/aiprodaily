import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Sparkles } from "lucide-react"

export function Hero() {
  return (
    <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8 bg-[#1c293d]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1c293d] border-2 border-white">
            <Sparkles className="w-4 h-4 text-[#06b6d4]" />
            <span className="text-xs font-medium bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
              Join 10,000+ accounting professionals
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight text-balance">
            Stay Ahead of AI Trends
            <br />
            in{" "}
            <span className="bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] bg-clip-text text-transparent">
              Accounting
            </span>{" "}
            and Finance
          </h1>

          {/* Subheadline */}
          <p className="text-base text-white/80 max-w-xl mx-auto leading-relaxed text-pretty">
            Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better
            outcomes.
          </p>

          {/* Email signup */}
          <div className="max-w-xl mx-auto">
            <form className="flex items-center gap-0 bg-white rounded-full border-2 border-[#1c293d] p-1.5 shadow-lg">
              <Input
                type="email"
                placeholder="Enter Your Email"
                className="flex-1 h-11 px-5 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-gray-400"
              />
              <Button className="h-11 px-6 bg-[#1c293d] hover:bg-[#1c293d]/90 text-white font-semibold rounded-full text-sm">
                Subscribe
              </Button>
            </form>
            <p className="text-xs text-white/60 mt-2">Free forever. Unsubscribe anytime. No spam, ever.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
