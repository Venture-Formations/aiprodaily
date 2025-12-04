import Link from 'next/link'

interface DirectoryHeroProps {
  toolCount: number
}

export function DirectoryHero({ toolCount }: DirectoryHeroProps) {
  return (
    <section className="bg-[#1c293d] text-white relative overflow-hidden">
      {/* Gradient accent overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#a855f7] via-[#06b6d4] to-[#14b8a6] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#06b6d4] to-[#14b8a6] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-14 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            AI Tools for Accounting Professionals
          </h1>
          <p className="mt-6 text-xl text-white/70 max-w-3xl mx-auto">
            Discover {toolCount}+ AI-powered tools to streamline your accounting workflow,
            automate tedious tasks, and boost your productivity.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#explore"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg bg-white text-[#1c293d] hover:bg-white/90 transition-colors"
            >
              Explore Tools
            </Link>
            <Link
              href="/tools/submit"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] text-white hover:opacity-90 transition-opacity"
            >
              Submit Your Tool
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="text-center">
            <div className="text-4xl font-bold">{toolCount}+</div>
            <div className="mt-1 text-white/60">AI Tools</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold">7</div>
            <div className="mt-1 text-white/60">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold">Free</div>
            <div className="mt-1 text-white/60">To Browse</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold">Daily</div>
            <div className="mt-1 text-white/60">Updates</div>
          </div>
        </div>
      </div>
    </section>
  )
}
