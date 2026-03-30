# Public Website Pages

## Component Pattern

Website pages are **server components** by default:

```typescript
export const dynamic = 'force-dynamic'  // fresh data on each request

export const metadata: Metadata = {
  title: 'Page Title - Newsletter Name',
  description: 'SEO description',
}

export default async function MyPage() {
  const { publicationId, settings } = await resolvePublicationFromRequest()

  const { data } = await supabaseAdmin
    .from('table')
    .select('col1, col2')
    .eq('publication_id', publicationId)

  return <main>...</main>
}
```

## Rules

- **Server components by default** — use `async/await` for data fetching
- **Add `'use client'` only for interactive elements** (forms, state)
- **Set `export const dynamic = 'force-dynamic'`** for pages that need fresh data
- **Export `metadata`** for SEO on every page

## Multi-Tenant Resolution

Resolve publication from the request domain:
```typescript
import { resolvePublicationFromRequest } from '@/lib/website-utils'
const { publicationId, host, settings } = await resolvePublicationFromRequest()
```

Fallback: if domain lookup fails, get the first active publication.

## SEO

Add JSON-LD structured data:
```typescript
const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description",
}

<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

## Settings

Use `getPublicationSettings()` for website-specific settings:
```typescript
const settings = await getPublicationSettings(publicationId, [
  'website_heading',
  'website_subheading',
  'website_callout_text',
])
```

## Key Tables

`archived_newsletters`, `manual_articles`, `article_categories`, `publications`, `publication_settings`
