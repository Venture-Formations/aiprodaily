## AI Pros Newsletter Platform – Feature Summaries

_Last updated: 2025-12-17_

### Documentation Map
- `docs/guides/` – feature implementations, onboarding plans, troubleshooting playbooks
- `docs/workflows/` – operational runbooks for scoring, RSS ingestion, and backfill steps
- `docs/migrations/` – schema change guides, historical migration status notes
- `docs/status/` – progress trackers, session notebooks, cleanup recommendations
- `docs/checklists/` – deployment and testing checklists
- `docs/reference/` – legacy references and cross-project research

### Multi-tenant Newsletter Framework
- **What it does:** Provides isolation for each newsletter brand (e.g., `AI Accounting Daily`) with subdomain-aware routing and tenant-specific configuration.
- **How it works:** Middleware inspects the request host, resolves the `publication_id`, and injects it into shared React/Server contexts. Admin users can switch tenants via the `admin/newsletters` selector which updates context-aware layouts and API requests.
- **Key Files / Functions:** `src/middleware.ts` (`middleware`); `src/lib/newsletter-context.ts` (`getNewsletterContext`, `requireNewsletterContext`); `src/contexts/NewsletterContext.tsx` (`NewsletterProvider`, `useNewsletter`); `src/app/api/newsletters/by-subdomain/route.ts` (`GET`).
- **Database Tables:** `publications`, `publication_settings`, `newsletter_domains` (via migration defaults).
- **Connections:** Every database query, API route, and workflow requires the tenant context to avoid data leakage. Settings, issues, AI prompts, and analytics all consume the resolved `publication_id`.

### Issue Lifecycle Management
- **What it does:** Orchestrates daily newsletter issues through statuses (draft → review → ready → sent) with both manual and automated transitions.
- **How it works:** Issue creation can be triggered by cron workflows or admin actions. State changes are persisted in `issues`, and downstream jobs (RSS processing, AI generation, sending) update status via server actions and REST endpoints.
- **Key Files / Functions:** `src/app/api/campaigns/route.ts` (`GET`, `POST`); `src/app/api/campaigns/[id]/route.ts` (`GET`, `PATCH`, `DELETE`); `src/app/api/campaigns/create-with-workflow/route.ts` (`POST`); `src/lib/workflows/process-rss-workflow.ts` (`setupissue`, `finalizeissue`); `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`.
- **Database Tables:** `issues`, `issue_articles`, `secondary_articles`, `manual_articles`, `email_metrics`, `user_activities`.
- **Connections:** Issues act as the hub for articles, subject lines, welcome sections, advertisements, polls, and analytics imports. Scheduler tasks monitor issue readiness before triggering email sends.

### Automated RSS Ingestion Workflow
- **What it does:** Fetches, deduplicates, and stages RSS posts nightly for each issue.
- **How it works:** Implemented as a multi-step Vercel Workflow with retry logic. Steps fetch feeds, archive historical data, assign posts to issues, and prepare AI generation batches.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`processRSSWorkflow`, `setupissue`, `generatePrimaryTitles`, `generateSecondaryBodiesBatch2`); `src/lib/rss-processor.ts` (`processFeed`, `scorePostsForSection`, `deduplicateissuePosts`); `src/app/api/workflows/process-rss/route.ts` (`POST`).
- **Database Tables:** `rss_feeds`, `rss_posts`, `post_ratings`, `issues`, `issue_post_groups`, `archived_rss_posts`.
- **Connections:** Supplies source material for scoring, article generation, subject line creation, and welcome summaries. Also informs duplicate cleanup and debug tooling.

### Multi-criteria Scoring Engine
- **What it does:** Evaluates RSS posts using weighted AI scores (e.g., relevance, impact) to rank content.
- **How it works:** Post ratings are stored in `post_ratings` via batched OpenAI calls with rate limiting and retry logic. Weight tuning is configurable in admin settings and applied when selecting top posts.
- **Key Files / Functions:** `src/lib/rss-processor.ts` (`evaluatePost`, `scorePostsForSection`, `updatePostRatings`); `src/app/api/rss/combined-steps/step3-score.ts` (`POST`); `src/app/api/backfill/criteria-4/route.ts` and `criteria-1-2-3/route.ts`.
- **Database Tables:** `post_ratings`, `rss_posts`, `rss_feeds`, `publication_settings` (criteria weights).
- **Connections:** Drives article selection for issues, triggers subject line regeneration when top-ranked posts change, and informs manual reviewers through UI indicators.

### AI-generated Primary and Secondary Articles
- **What it does:** Produces six primary and six secondary article drafts per issue with AI-authored headlines and bodies.
- **How it works:** Workflow steps invoke structured prompts for titles and bodies in batched groups. Outputs are stored in `issue_articles` and `secondary_articles` tables linked to issues.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`generatePrimaryTitles`, `generatePrimaryBodiesBatch1`, `generateSecondaryBodiesBatch2`); `src/lib/openai.ts` (`AI_CALL.primaryTitles`, `AI_CALL.primaryBodies`, `AI_CALL.secondaryBodies`); `src/app/api/debug/test-article-generation/route.ts`.
- **Database Tables:** `issue_articles`, `secondary_articles`, `rss_posts`, `post_ratings`, `issues`.
- **Connections:** Article content feeds the fact-checking feature, welcome-section summarization, preview pages, and final email rendering. Manual toggles and edits operate on these generated records.

### AI Fact-checking Gate
- **What it does:** Validates generated articles to ensure factual accuracy before publishing.
- **How it works:** Dedicated workflow steps send article/source pairs to AI fact-check prompts, storing scores and reasoning. Articles failing thresholds can be flagged for manual review.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`factCheckPrimary`, `factCheckSecondary`); `src/lib/openai.ts` (`AI_CALL.primaryFactCheck`, `AI_CALL.secondaryFactCheck`); `src/app/api/debug/verify-criteria-columns/route.ts`.
- **Database Tables:** `issue_articles`, `secondary_articles`, `fact_check_logs`, `issues`.
- **Connections:** Fact-check results surface in dashboards, influence readiness status, and factor into subject line or welcome updates when articles are replaced.

### Automated Welcome Section Generation
- **What it does:** Writes a conversational newsletter introduction summarizing selected stories.
- **How it works:** Uses the `ai_prompt_welcome_section` prompt, inserting active primary and secondary articles to generate text stored on the issue. Regeneration endpoints trigger when article selections change.
- **Key Files / Functions:** `src/app/api/campaigns/[id]/regenerate-welcome/route.ts` (`POST`); `src/lib/openai.ts` (`AI_CALL.welcomeSection`, `callWithStructuredPrompt`); `src/app/api/ai/load-prompt/route.ts` (`GET` for prompt defaults).
- **Database Tables:** `issues` (`welcome_intro`, `welcome_tagline`, `welcome_summary`), `issue_articles`, `secondary_articles`, `publication_settings`.
- **Connections:** Appears in email previews and depends on article selection, AI prompt management, and issue workflows. Manual edits in admin dashboards override generated content if needed.

### Dynamic Subject Line Generation
- **What it does:** Produces and refreshes email subject lines based on top-ranked articles.
- **How it works:** API routes call AI prompts using current primary article ordering. Regeneration triggers automatically when article rankings shift or manually via admin controls.
- **Key Files / Functions:** `src/app/api/campaigns/[id]/generate-subject/route.ts` (`POST`); `src/app/api/cron/generate-subject/route.ts`; `src/lib/openai.ts` (`AI_CALL.subjectLineGenerator`); `src/lib/subject-line-generator.ts` (`generateSubjectLineForissue`).
- **Database Tables:** `issues` (`subject_line`, `subject_line_history`), `issue_articles`, `post_ratings`, `user_activities`.
- **Connections:** Tightly coupled with scoring engine, issue lifecycle, and MailerLite send readiness. Subject lines are logged for analytics and performance tracking.

### Manual Article Management
- **What it does:** Enables editors to add, toggle, reorder, or skip articles within each issue.
- **How it works:** Admin UI exposes CRUD operations on manual articles and switches on generated pieces. Updates propagate through Supabase mutations and trigger downstream regeneration hooks where needed.
- **Key Files / Functions:** `src/app/api/articles/manual/route.ts` (`GET`, `POST`); `src/app/api/campaigns/[id]/articles/toggle/route.ts`; `src/app/api/campaigns/[id]/articles/reorder/route.ts`; `src/app/dashboard/[slug]/campaigns/[id]/components/ArticleList.tsx`.
- **Database Tables:** `manual_articles`, `issue_articles`, `secondary_articles`, `user_activities`, `issues`.
- **Connections:** Manual adjustments influence subject lines, welcome section copy, and final email content. They are tracked within issue history for audit/debug endpoints.

### AI Apps Directory & Selection
- **What it does:** Catalogs AI tools relevant to newsletter audiences with full CRUD management and automatic rotation.
- **How it works:** Database tables for AI applications are exposed via REST APIs and admin pages. Selection logic rotates apps per issue with affiliate priority (3x weight) and cooldown periods.
- **Key Files / Functions:** `src/app/api/ai-apps/route.ts` (`GET`, `POST`); `src/app/api/ai-apps/[id]/route.ts` (`PATCH`, `DELETE`); `src/app/api/ai-apps/upload/route.ts`; `src/app/dashboard/[slug]/settings/ai-apps/page.tsx`; `src/lib/app-selector.ts` (`selectAppsForissue`).
- **Database Tables:** `ai_applications`, `issue_ai_app_selections`, `publication_settings`.
- **Selection Logic:**
  - Affiliates: 3x selection priority + cooldown period (configurable, default 7 days)
  - Non-affiliates: Cycle through all before repeating (no cooldown)
- **Connections:** Shares components with prompt management, appears in issue previews, and can be referenced in welcome/introduction copy or ads.

### Centralized AI Prompt Management
- **What it does:** Centralizes editing, testing, and versioning of AI prompts used throughout the system.
- **How it works:** Settings pages load prompts from `publication_settings`, allow inline edits, testing via debug APIs, and structured prompt JSON support. Migration scripts keep defaults synchronized.
- **Key Files / Functions:** `src/app/api/ai/load-prompt/route.ts`, `save-prompt/route.ts`, `test-prompt/route.ts`, `test-prompt-multiple/route.ts`; `src/app/api/ai/load-prompt-template/route.ts`; `src/app/dashboard/[slug]/settings/ai-prompts/page.tsx`; `src/lib/openai.ts` (`callWithStructuredPrompt`, `callAIWithPrompt`).
- **Database Tables:** `publication_settings`, `prompt_templates`, `prompt_test_logs`.
- **Connections:** Powers all AI-driven features (articles, welcome, subject lines, scoring). Changes cascade to workflows immediately, so audit tools log edits for traceability.

### Advertisement Management
- **What it does:** Collects advertiser submissions, processes payments, and schedules approved placements in newsletters.
- **How it works:** Public submission forms feed Supabase tables, payment verification occurs via Stripe webhooks, and admins approve ads to assign positions. Scheduler ensures ads appear in the correct issue layout.
- **Key Files / Functions:** `src/app/ads/submit/page.tsx` (intake form); `src/app/api/ads/route.ts` (`POST` submission); `src/app/api/ads/[id]/approve/route.ts`, `reject/route.ts`, `activate/route.ts`; `src/app/api/ads/verify-payment/route.ts`; `src/lib/ad-scheduler.ts` (`scheduleissueAds`, `assignBackupAds`).
- **Database Tables:** `advertisements`, `ad_orders`, `issue_advertisements`, `ad_assets`, `payments`.
- **Connections:** Issue rendering consumes active ads, link tracking monitors performance, and Slack notifications alert staff to pending approvals.

### Polls System
- **What it does:** Allows creation of audience polls with response tracking and analytics.
- **How it works:** Admins configure polls, activate them for issues, and collect responses via dedicated endpoints. Analytics pages aggregate results for review.
- **Key Files / Functions:** `src/app/api/polls/route.ts` (`GET`, `POST`); `src/app/api/polls/[id]/route.ts` (`PATCH`, `DELETE`); `src/app/api/polls/[id]/responses/route.ts`; `src/app/dashboard/polls/page.tsx`; `src/app/api/polls/active/route.ts`.
- **Database Tables:** `polls`, `poll_responses`, `issues`, `user_activities`.
- **Connections:** Poll entries appear in newsletter content and dashboards. Poll metadata can influence subject line copy or welcome text referencing audience engagement.

### Subscriber Feedback Capture
- **What it does:** Gathers qualitative feedback from readers and surfaces gratitude/confirmation flows.
- **How it works:** Feedback endpoints accept responses tied to issues, store them with metadata, and send users to thank-you pages. Analytics APIs expose aggregated sentiments.
- **Key Files / Functions:** `src/app/api/feedback/track/route.ts` (`GET`); `src/app/api/feedback/analytics/route.ts`; `src/app/feedback/thank-you/page.tsx`; `src/app/feedback/error/page.tsx`.
- **Database Tables:** `feedback_responses`, `issues`, `mailerlite_events`.
- **Connections:** Feedback insights inform analytics dashboards, Slack alerts, and future content adjustments. Issue status pages display feedback summaries for editors.

### Link Tracking and Performance Analytics
- **What it does:** Tracks email link clicks and imports MailerLite performance data for reporting.
- **How it works:** Redirect endpoints log click events before forwarding to targets. Cron jobs call MailerLite APIs to import open/click metrics and store them against issues and articles.
- **Key Files / Functions:** `src/app/api/link-tracking/click/route.ts` (`GET`); `src/app/api/link-tracking/analytics/route.ts`; `src/app/api/cron/import-metrics/route.ts`; `src/lib/mailerlite.ts` (`importissueMetrics`, `fetchissueReport`); `src/app/dashboard/[slug]/analytics/page.tsx`.
- **Database Tables:** `link_clicks`, `email_metrics`, `issues`, `issue_articles`, `issue_advertisements`.
- **Connections:** Analytics dashboards display these metrics, influencing editorial strategies, advertiser reporting, and subject line optimization loops.

### Public Website and Newsletter Archive
- **What it does:** Hosts the marketing site (`aiaccountingdaily.com`) and archive of published newsletters.
- **How it works:** Next.js routes render static-dynamic hybrid pages pulling from issue articles and metadata. Archive pages iterate over issue history with SSR caching.
- **Key Files / Functions:** `src/app/website/page.tsx`, `src/app/website/newsletters/page.tsx`, `src/app/website/newsletter/[date]/page.tsx`; `src/app/api/newsletters/archived/route.ts`; `src/lib/newsletter-templates.ts` (`renderPublicNewsletterHtml`).
- **Database Tables:** `issues`, `issue_articles`, `secondary_articles`, `manual_articles`, `newsletter_sections`, `archived_articles`.
- **Connections:** Issue lifecycle completion publishes entries to the archive, and manual edits in admin dashboards reflect on the public site. Link tracking leverages archive URLs.

**Note:** The `apps/marketing/` folder referenced in older docs does not exist. Marketing pages are now at `src/app/website/`.

### Comprehensive Admin Settings
- **What it does:** Provides granular configuration panels for scoring weights, prompts, email settings, schedules, Slack notifications, branding assets, and more.
- **How it works:** Each settings page reads and writes scoped `publication_settings` entries, uploading files where needed (logos, header images). Validation ensures tenant isolation.
- **Key Files / Functions:** `src/app/dashboard/[slug]/settings/page.tsx`; `src/app/dashboard/[slug]/settings/criteria/page.tsx`; `src/app/api/settings/criteria/route.ts`; `src/app/api/settings/email/route.ts`; `src/app/api/settings/upload-business-image/route.ts`; `src/app/api/settings/slack/route.ts`.
- **Database Tables:** `publication_settings`, `newsletter_settings`, `images`, `business_profiles`, `email_settings`.
- **Connections:** Settings directly affect AI behavior, issue workflows, advertisement display, and external integrations. Cron jobs read schedule configurations from these values.

### Image Ingestion and Review Utilities
- **What it does:** Manages image uploads, ingestion from source content, deduplication, and reverse-lookup verification.
- **How it works:** API routes process uploads, store metadata (including GitHub-hosted URLs), and provide review UIs for editors. Reverse lookup endpoints help avoid repeated assets or copyright issues.
- **Key Files / Functions:** `src/app/api/images/upload-url/route.ts` (`POST`); `src/app/api/images/review/route.ts`; `src/app/api/images/ingest/route.ts`; `src/lib/github-storage.ts` (`uploadToGitHub`, `ensureRepositoryExists`); `src/lib/article-extractor.ts` (`extractPrimaryImage`).
- **Database Tables:** `images`, `image_variants`, `article_images`, `advertisement_images`, `issues`.
- **Connections:** Articles, advertisements, and public archive pages pull from the curated image library. Cron jobs and workflows rely on image availability before finalizing issues.

### Cron and Automation Suite
- **What it does:** Automates recurring tasks such as issue creation, RSS processing, health checks, and performance metric imports.
- **How it works:** Vercel cron jobs call secured API routes, each executing a focused task with retry logic and logging. Some cron endpoints orchestrate Vercel Workflows for long-running processes.
- **Key Files / Functions:** `src/app/api/cron/create-campaign/route.ts`; `cron/ingest-rss/route.ts`; `cron/process-rss/route.ts`; `cron/send-review/route.ts`; `cron/send-final/route.ts`; `cron/health-check/route.ts`; `cron/import-metrics/route.ts`; `src/lib/workflows/process-rss-workflow.ts`; `src/lib/workflows/reprocess-articles-workflow.ts`.
- **Database Tables:** `cron_jobs`, `issues`, `workflow_runs`, `system_logs`, `email_metrics`.
- **Connections:** Keeps issue lifecycle on schedule, triggers AI pipelines, populates analytics, and monitors system health. Relies on settings, prompt configurations, and issue states.

### Error Monitoring and Debug Tooling
- **What it does:** Provides observability via Slack alerts, log dashboards, and a suite of diagnostic endpoints.
- **How it works:** Errors are captured in `system_logs`, surfaced in dashboards, and, for critical issues, pushed to Slack. Debug endpoints allow inspecting issues, articles, AI prompts, and RSS data.
- **Key Files / Functions:** `src/lib/slack.ts` (`SlackNotificationService`, `sendRSSIncompleteAlert`); `src/app/api/notifications/slack/route.ts`; `src/app/api/logs/route.ts`; `src/app/dashboard/logs/page.tsx`; `src/app/api/debug/recent-campaigns/route.ts`; `src/app/api/debug/campaign-articles/route.ts`; `src/app/api/debug/test-ai-prompts/route.ts`.
- **Database Tables:** `system_logs`, `debug_reports`, `issues`, `issue_articles`, `rss_posts`.
- **Connections:** Supports every feature by enabling rapid troubleshooting. Workflows, cron jobs, and manual UIs reference logs to resolve failures quickly.

### AI Tools Directory
- **What it does:** Public-facing catalog of AI tools with browsing, search, categorization, and submission capabilities.
- **How it works:** Tools are stored in the database with categories, descriptions, and metadata. Users can browse by category, search, view individual tools, and submit new listings. Tool owners can claim listings for verified status. All directory functions accept an optional `publicationId` parameter for multi-tenant isolation; admin actions filter by `publication_id`.
- **Multi-tenant:** Directory functions in `directory.ts` accept optional `publicationId` (defaults to `PUBLICATION_ID` from config). Public pages use `SITE_BASE_URL` for SEO metadata. Admin actions in `actions.ts` scope all mutations to `PUBLICATION_ID`.
- **Key Files / Functions:** `src/app/tools/page.tsx` (listing); `src/app/tools/[id]/page.tsx` (detail); `src/app/tools/submit/page.tsx` (submission form); `src/app/tools/category/[slug]/page.tsx` (category view); `src/lib/directory.ts` (business logic); `src/app/api/tools/route.ts` (API).
- **Database Tables:** `tools`, `tool_categories`, `tool_claims`, `tool_entitlements`, `sponsorship_packages`.
- **Connections:** Integrated with account system for tool claims. Admin panel at `/dashboard/[slug]/tools-admin/` manages entitlements, packages, and settings.

### User Account & Advertiser Portal
- **What it does:** Self-service portal for users and advertisers to manage ads, billing, and profile settings.
- **How it works:** Users can create ad campaigns, view their ads, manage billing through Stripe integration, and update profile settings. Advertisers can track ad performance and upgrade subscriptions.
- **Multi-tenant:** Account pages use `resolvePublicationFromRequest()` for host-based publication resolution. Account API routes use `getPublicationByDomain(host)`. Stripe checkout metadata includes `publication_id` so webhooks can resolve the correct publication. Account layout uses host-based resolution instead of `.limit(1).single()`.
- **Key Files / Functions:** `src/app/account/page.tsx` (dashboard); `src/app/account/ads/page.tsx` (ad management); `src/app/account/billing/page.tsx` (billing); `src/app/account/upgrade/page.tsx` (subscription upgrade); `src/app/api/account/` (API routes); `src/app/api/stripe/` (Stripe webhooks).
- **Database Tables:** `users`, `user_profiles`, `advertisements`, `ad_orders`, `payments`, `subscriptions`.
- **Connections:** Integrates with Stripe for payments, MailerLite for subscriber data, and the advertisement system for ad placement.

### Events System
⚠️ **Status: NOT IMPLEMENTED** — Folder structure exists but no routes are implemented.

- **What it does:** (Planned) Community events management with submission, display, and ticketing capabilities.
- **Current State:**
  - `src/app/events/` — Folder structure exists but all page routes are empty
  - `src/app/api/events/` — Does NOT exist
  - `/api/cron/sync-events` — Folder exists but no route.ts
  - `/api/cron/populate-events` — Folder exists but no route.ts
- **To Implement:**
  1. Create API routes at `src/app/api/events/route.ts`
  2. Add page components to `src/app/events/*/page.tsx`
  3. Implement cron routes for event sync
  4. Create `events` and `event_registrations` tables if needed

### Secondary Newsletter System
- **What it does:** Supports sending a secondary newsletter with distinct content from the primary.
- **How it works:** Secondary articles are generated and stored separately. A dedicated send cron (`send-secondary`) handles distribution via MailerLite.
- **Key Files / Functions:** `/api/cron/send-secondary/route.ts` (send trigger); `src/lib/workflows/process-rss-workflow.ts` (secondary article generation); `src/lib/newsletter-templates.ts` (secondary template rendering).
- **Database Tables:** `secondary_articles`, `issues`, `rss_posts` (with `use_for_secondary_section` flag).
- **Connections:** Uses same infrastructure as primary newsletter but with separate content pipeline and send schedule.

### SendGrid Integration
- **What it does:** Alternative email provider to MailerLite for sending newsletters.
- **How it works:** SendGrid API integration with webhook processing for delivery events. Configurable per publication.
- **Key Files / Functions:** `src/lib/sendgrid.ts` (SendGrid client); `/api/cron/process-sendgrid-updates/route.ts` (webhook processing).
- **Database Tables:** `email_metrics`, `mailerlite_field_updates` (shared with MailerLite).
- **Connections:** Can be used alongside or instead of MailerLite. Shares analytics infrastructure.

### Breaking News Processing
- **What it does:** Handles urgent breaking news content for immediate distribution.
- **How it works:** Breaking news processor evaluates incoming content for urgency and can trigger expedited publication workflows.
- **Key Files / Functions:** `src/lib/breaking-news-processor.ts` (processor); `/api/cron/process-breaking-news/route.ts` (cron trigger).
- **Database Tables:** `rss_posts` (with breaking news flags), `issues`.
- **Connections:** Integrates with RSS ingestion and workflow systems for prioritized content handling.

### Weather & Wordle Modules (Legacy)
⚠️ **Status: PARTIALLY IMPLEMENTED** — Library code exists but cron routes are empty.

- **What it does:** Optional content modules for weather forecasts and Wordle statistics.
- **Current State:**
  - `src/lib/wordle-scraper.ts` — Library code EXISTS ✅
  - `/api/cron/generate-weather/` — Folder exists but no route.ts ⚠️
  - `/api/cron/collect-wordle/` — Folder exists but no route.ts ⚠️
- **To Complete:**
  1. Create `src/app/api/cron/generate-weather/route.ts`
  2. Create `src/app/api/cron/collect-wordle/route.ts`
  3. Or remove from `vercel.json` if not needed
