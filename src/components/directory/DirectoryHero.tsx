import Link from 'next/link'
import { Container } from '@/components/salient/Container'

interface DirectoryHeroProps {
  toolCount: number
}

export function DirectoryHero({ toolCount }: DirectoryHeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative gradient blur blotch */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-100 via-slate-50 to-cyan-100 rounded-full blur-3xl opacity-60 -z-10"></div>

      <Container className="relative pt-10 pb-10 text-center lg:pt-16">
        {/* Social proof badge */}
        <div className="inline-flex items-center px-5 py-2.5 bg-slate-900 rounded-full mb-8 shadow-sm">
          <span className="text-sm font-semibold text-white">{toolCount}+ AI tools for accounting professionals</span>
        </div>

        <h1 className="mx-auto max-w-4xl font-display text-4xl font-medium tracking-tight text-slate-900 sm:text-6xl">
          Discover{' '}
          <span className="relative whitespace-nowrap">
            <svg
              aria-hidden="true"
              viewBox="0 0 418 42"
              className="absolute top-2/3 left-0 h-[0.58em] w-full fill-cyan-300/70"
              preserveAspectRatio="none"
            >
              <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
            </svg>
            <span className="relative bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI Tools</span>
          </span>{' '}
          for Your Practice
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg tracking-tight text-slate-700">
          Browse our curated collection of AI-powered tools to streamline your
          accounting workflow, automate tedious tasks, and boost productivity.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="#categories"
            className="group inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Browse by Category
          </Link>
          <Link
            href="/tools/submit"
            className="group inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-all"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Submit Your Tool
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">{toolCount}+</div>
            <div className="mt-1 text-sm text-slate-500">AI Tools</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">7</div>
            <div className="mt-1 text-sm text-slate-500">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">Free</div>
            <div className="mt-1 text-sm text-slate-500">To Browse</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-900">Daily</div>
            <div className="mt-1 text-sm text-slate-500">Updates</div>
          </div>
        </div>
      </Container>
    </section>
  )
}
