# Website

This directory contains the landing page and public website code.

**Source Repository:** https://github.com/Venture-Formations/ai-accounting-daily-homepage

**Sync Method:** Automated via GitHub Actions workflow (`.github/workflows/sync-website.yml`)

## For Website Developers

Continue working in the source repository: `ai-accounting-daily-homepage`

Changes will be automatically synced to this directory when the sync workflow is triggered.

## Accessing Newsletter APIs

The website can access newsletter business settings and data via:

```typescript
// Use relative URLs (works in production)
const response = await fetch('/api/settings/business')
const settings = await response.json()

// For local development, use full URL
const response = await fetch('http://localhost:3000/api/settings/business')
```

## Local Development

```bash
cd website
npm install
npm run dev
```

The website will run on a separate port from the main admin dashboard.
