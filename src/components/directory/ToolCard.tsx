import Link from 'next/link'
import Image from 'next/image'
import type { DirectoryToolWithCategories } from '@/types/database'

interface ToolCardProps {
  tool: DirectoryToolWithCategories
}

// Generate a consistent color based on the tool name
function getColorFromName(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function ToolCard({ tool }: ToolCardProps) {
  // Use logo_image_url for the card, fall back to listing image
  const logoUrl = tool.logo_image_url || tool.tool_image_url || null
  const firstLetter = tool.tool_name.charAt(0).toUpperCase()
  const bgColor = getColorFromName(tool.tool_name)

  return (
    <Link href={`/tools/${tool.id}`}>
      <div className={`group flex items-center gap-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden p-4 ${
        tool.is_featured ? 'border-2 border-[#06b6d4]' : 'border border-gray-100'
      }`}>
        {/* Logo Image - Square */}
        <div className="relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={tool.tool_name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              sizes="64px"
            />
          ) : (
            <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
              <span className="text-white font-bold text-2xl sm:text-3xl">
                {firstLetter}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#06b6d4] transition-colors truncate">
              {tool.tool_name}
            </h3>
            {tool.is_sponsored && (
              <span className="flex-shrink-0 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                Sponsored
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {tool.description}
          </p>

          {/* Categories and Featured Badge */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {tool.categories.slice(0, 3).map((category, catIndex) => (
              <span key={category.id} className="text-sm text-gray-500">
                {category.name}{catIndex < Math.min(tool.categories.length, 3) - 1 && ' · '}
              </span>
            ))}
            {tool.categories.length > 3 && (
              <span className="text-sm text-gray-400">
                +{tool.categories.length - 3} more
              </span>
            )}
            {tool.is_featured && !tool.is_sponsored && (
              <span className="flex-shrink-0 bg-[#06b6d4] text-white text-xs font-semibold px-2 py-0.5 rounded-full ml-1">
                Featured
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
