import Link from 'next/link'
import type { DirectoryCategoryWithTools } from '@/types/database'

interface CategoryCardProps {
  category: DirectoryCategoryWithTools
}

// Category icons mapping
const categoryIcons: Record<string, string> = {
  'Accounting System': 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  'Banking': 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  'Client Management': 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  'Finance': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'HR': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  'Payroll': 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  'Productivity': 'M13 10V3L4 14h7v7l9-11h-7z'
}

export function CategoryCard({ category }: CategoryCardProps) {
  const iconPath = categoryIcons[category.name] || categoryIcons['Productivity']

  return (
    <Link href={`/tools/category/${category.slug}`}>
      <div className="group p-6 bg-white rounded-xl border border-gray-200 hover:border-[#06b6d4] hover:shadow-lg transition-all duration-200">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-[#06b6d4]/10 rounded-lg flex items-center justify-center group-hover:bg-[#1c293d] transition-colors">
            <svg
              className="w-6 h-6 text-[#06b6d4] group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#06b6d4] transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-gray-500">
              {category.tool_count} {category.tool_count === 1 ? 'tool' : 'tools'}
            </p>
          </div>

          {/* Arrow */}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-[#06b6d4] group-hover:translate-x-1 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {category.description && (
          <p className="mt-3 text-sm text-gray-600 line-clamp-2">
            {category.description}
          </p>
        )}
      </div>
    </Link>
  )
}
