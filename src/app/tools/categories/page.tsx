import Link from 'next/link'
import { getApprovedCategories } from '@/lib/directory'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const categories = await getApprovedCategories()

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900">Browse by Category</h1>
        <p className="mt-4 text-lg text-gray-600">
          Find the perfect AI tool for your specific accounting needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => (
          <Link
            key={category.id}
            href={`/tools/category/${category.slug}`}
            className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-[#06b6d4] transition-all"
          >
            <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#06b6d4] transition-colors">
                {category.name}
              </h3>
              <p className="text-sm text-gray-500">
                {category.tool_count} {category.tool_count === 1 ? 'tool' : 'tools'}
              </p>
            </div>
            {category.description && (
              <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                {category.description}
              </p>
            )}
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories found.</p>
        </div>
      )}
    </div>
  )
}
