'use client'

export default function ArticlesTab({ slug }: { slug: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-600">Articles database content will be moved here.</p>
      <p className="text-sm text-gray-500 mt-2">
        This will include the full articles database functionality from /databases/articles
      </p>
      <p className="text-sm text-brand-primary mt-4">
        <a href={`/dashboard/${slug}/databases/articles`} className="underline">
          View current articles database →
        </a>
      </p>
    </div>
  )
}
