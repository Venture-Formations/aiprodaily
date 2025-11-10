# Debug API Route Groups

Debug endpoints now live inside route-group directories so the URL structure stays the same while the file tree remains manageable.

| Route Group | Purpose | Example Endpoints |
|-------------|---------|-------------------|
| `(campaign)` | Campaign lifecycle + archiving tools | `/api/debug/campaign-articles`, `/api/debug/recent-campaigns` |
| `(checks)` | Read-only diagnostics and environment validation | `/api/debug/check-prompts`, `/api/debug/verify-multitenant` |
| `(maintenance)` | Schema migrations, data fixes, and reset utilities | `/api/debug/add-phase2-statuses`, `/api/debug/update-image-urls` |
| `(ai)` | AI prompt/app configuration helpers | `/api/debug/list-ai-prompts`, `/api/debug/manual-select-apps` |
| `(rss)` | RSS ingestion helpers and backfills | `/api/debug/rss-status`, `/api/debug/backfill-full-text` |
| `(media)` | Image upload, processing, and storage utilities | `/api/debug/images`, `/api/debug/process-images` |
| `(integrations)` | External services (MailerLite, Stripe, OAuth) | `/api/debug/mailerlite-test`, `/api/debug/setup-stripe-webhook` |
| `(tests)` | Safe-to-run smoke tests and local verification | `/api/debug/test-mailerlite`, `/api/debug/middleware-test` |

Route groups do not change the public path; each folder still exports a `route.ts` (or nested route) that maps to `/api/debug/<name>`.

