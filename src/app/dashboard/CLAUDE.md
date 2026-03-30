# Dashboard Pages

## Component Pattern

All dashboard pages are **client components**:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function MyDashboardPage() {
  const { slug } = useParams() as { slug: string }
  const [data, setData] = useState<MyType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [slug])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/my-endpoint?newsletter_slug=${slug}`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setData(json.items)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }
}
```

## Rules

- **Always `'use client'`** — dashboard pages use React hooks and browser APIs
- **Use `useParams()`** for the `[slug]` dynamic segment
- **Fetch via `/api/*` routes** — never import `supabaseAdmin` directly in client code
- **Pass `newsletter_slug` or `publication_id`** as query params to API routes
- **Handle loading and error states** — show spinners/messages, don't leave blank

## Date Handling (CRITICAL)

Parse dates as local to avoid timezone shifts:
```typescript
const formatDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}
```

Never use `new Date(dateString)` directly — it parses as UTC and shifts the day.

## Navigation

- Use `useRouter()` for programmatic navigation
- Use Next.js `<Link>` for declarative navigation
- Dashboard routes: `/dashboard/[slug]/...`
