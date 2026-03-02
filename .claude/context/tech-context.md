---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Tech Context

## Language & Runtime
- **TypeScript** (strict mode) on Node.js 18+
- **Next.js 15** with App Router (React 19)

## Framework & Libraries
| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js | 15.4.10 |
| React | React / React DOM | 19.2.1 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.39.7 |
| AI | OpenAI SDK | 6.10.0 |
| AI | Anthropic SDK | 0.67.0 |
| Email | MailerLite | custom client in `src/lib/mailerlite/` |
| Email (alt) | SendGrid | @sendgrid/mail 8.1.6 |
| Payments | Stripe | 20.0.0 |
| Auth | NextAuth | 4.24.13 |
| CSS | Tailwind CSS 4 | 4.1.15 |
| UI | Headless UI, Heroicons, Lucide, Radix | various |
| Charts | Recharts | 3.7.0 |
| RSS | rss-parser | 3.13.0 |
| Scraping | Cheerio, Readability, Linkedom | various |
| Validation | Zod | 4.1.13 |
| Testing | Vitest | 4.0.18 |
| Animation | Motion | 12.23.11 |
| Rich Text | Quill / react-quill-new | 2.0.3 / 3.6.0 |
| Drag & Drop | dnd-kit | 6.3.1 / 10.0.0 |

## Dev Dependencies
- Vitest + @vitest/coverage-v8 for unit testing
- vite-tsconfig-paths for path resolution
- @types/nodemailer, @types/uuid

## Hosting & Infrastructure
- **Vercel** -- Serverless deployment with cron jobs
- **Supabase** -- Managed PostgreSQL
- **GitHub** -- Source control + image hosting

## Key Environment Variables
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (optional)
- `MAILERLITE_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `CRON_SECRET`
- `GITHUB_TOKEN`, `GITHUB_REPO`

## Build & Dev Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript checking |
| `npm run test:run` | Vitest unit tests |
