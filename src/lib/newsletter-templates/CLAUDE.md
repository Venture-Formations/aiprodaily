# Newsletter Templates (HTML Email Generation)

## Email HTML Rules

- **Inline styles only** — no `<style>` blocks or external CSS. Email clients strip them.
- **Table-based layout** — use `<table role="presentation">` for structure, not `<div>`
- **Max width 750px** — all content wrapped in `style="max-width:750px;margin:0 auto;"`
- **Empty sections return `''`** — never return `null` from a section generator

## MailerLite Personalization

Use MailerLite merge tag syntax for subscriber fields:
```
{$name|default('Pro')}      — subscriber name with fallback
{$email}                      — subscriber email
```

## Tracking URLs

Wrap all clickable URLs with tracking:
```typescript
import { wrapTrackingUrl } from './helpers'
const trackedUrl = wrapTrackingUrl(originalUrl, issueId, linkType)
```

## Business Settings

Pre-fetch settings to avoid N+1 queries:
```typescript
const businessSettings = await fetchBusinessSettings(publicationId)
// Pass to section generators as parameter
generateWelcomeSection(intro, tagline, summary, publicationId, businessSettings)
```

## Block Order

Article modules use configurable `block_order` arrays:
```typescript
const blockOrder: ArticleBlockType[] = mod.block_order || ['title', 'body']
// Render blocks in this order for each article
```

## Alt Text

Always sanitize alt text for images:
```typescript
import { sanitizeAltText } from './helpers'
const alt = sanitizeAltText(article.image_alt || article.headline)
```

## Key Tables

`publication_issues`, `module_articles`, `article_modules`, `newsletter_sections`, `ad_modules`, `advertisements`, `issue_module_ads`, `polls`, `text_box_modules`

## Font Handling

Use `bodyFont` from business settings — never hardcode font families:
```typescript
const { bodyFont } = businessSettings
style="font-family: ${bodyFont}; font-size: 16px;"
```
