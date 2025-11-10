## AI Pros Newsletter Platform – Feature Summaries

### Documentation Map
- `docs/guides/` – feature implementations, onboarding plans, troubleshooting playbooks
- `docs/workflows/` – operational runbooks for scoring, RSS ingestion, and backfill steps
- `docs/migrations/` – schema change guides, historical migration status notes
- `docs/status/` – progress trackers, session notebooks, cleanup recommendations
- `docs/checklists/` – deployment and testing checklists
- `docs/reference/` – legacy references and cross-project research

### Multi-tenant Newsletter Framework
- **What it does:** Provides isolation for each newsletter brand (e.g., `AI Accounting Daily`) with subdomain-aware routing and tenant-specific configuration.
- **How it works:** Middleware inspects the request host, resolves the `newsletter_id`, and injects it into shared React/Server contexts. Admin users can switch tenants via the `admin/newsletters` selector which updates context-aware layouts and API requests.
- **Key Files / Functions:** `src/middleware.ts` (`middleware`); `src/lib/newsletter-context.ts` (`getNewsletterContext`, `requireNewsletterContext`); `src/contexts/NewsletterContext.tsx` (`NewsletterProvider`, `useNewsletter`); `src/app/api/newsletters/by-subdomain/route.ts` (`GET`).
- **Database Tables:** `newsletters`, `app_settings`, `newsletter_domains` (via migration defaults).
- **Connections:** Every database query, API route, and workflow requires the tenant context to avoid data leakage. Settings, campaigns, AI prompts, and analytics all consume the resolved `newsletter_id`.

### Campaign Lifecycle Management
- **What it does:** Orchestrates daily newsletter campaigns through statuses (draft → review → ready → sent) with both manual and automated transitions.
- **How it works:** Campaign creation can be triggered by cron workflows or admin actions. State changes are persisted in `newsletter_campaigns`, and downstream jobs (RSS processing, AI generation, sending) update status via server actions and REST endpoints.
- **Key Files / Functions:** `src/app/api/campaigns/route.ts` (`GET`, `POST`); `src/app/api/campaigns/[id]/route.ts` (`GET`, `PATCH`, `DELETE`); `src/app/api/campaigns/create-with-workflow/route.ts` (`POST`); `src/lib/workflows/process-rss-workflow.ts` (`setupCampaign`, `finalizeCampaign`); `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`.
- **Database Tables:** `newsletter_campaigns`, `articles`, `secondary_articles`, `manual_articles`, `email_metrics`, `user_activities`, `campaign_jobs`.
- **Connections:** Campaigns act as the hub for articles, subject lines, welcome sections, advertisements, polls, and analytics imports. Scheduler tasks monitor campaign readiness before triggering email sends.

### Automated RSS Ingestion Workflow
- **What it does:** Fetches, deduplicates, and stages RSS posts nightly for each campaign.
- **How it works:** Implemented as a multi-step Vercel Workflow with retry logic. Steps fetch feeds, archive historical data, assign posts to campaigns, and prepare AI generation batches.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`processRSSWorkflow`, `setupCampaign`, `generatePrimaryTitles`, `generateSecondaryBodiesBatch2`); `src/lib/rss-processor.ts` (`processFeed`, `scorePostsForSection`, `deduplicateCampaignPosts`); `src/app/api/workflows/process-rss/route.ts` (`POST`).
- **Database Tables:** `rss_feeds`, `rss_posts`, `post_ratings`, `newsletter_campaigns`, `campaign_post_groups`, `archived_rss_posts`.
- **Connections:** Supplies source material for scoring, article generation, subject line creation, and welcome summaries. Also informs duplicate cleanup and debug tooling.

### Multi-criteria Scoring Engine
- **What it does:** Evaluates RSS posts using weighted AI scores (e.g., relevance, impact) to rank content.
- **How it works:** Post ratings are stored in `post_ratings` via batched OpenAI calls with rate limiting and retry logic. Weight tuning is configurable in admin settings and applied when selecting top posts.
- **Key Files / Functions:** `src/lib/rss-processor.ts` (`evaluatePost`, `scorePostsForSection`, `updatePostRatings`); `src/app/api/rss/combined-steps/step3-score.ts` (`POST`); `src/app/api/backfill/criteria-4/route.ts` and `criteria-1-2-3/route.ts`.
- **Database Tables:** `post_ratings`, `rss_posts`, `rss_feeds`, `app_settings` (criteria weights).
- **Connections:** Drives article selection for campaigns, triggers subject line regeneration when top-ranked posts change, and informs manual reviewers through UI indicators.

### AI-generated Primary and Secondary Articles
- **What it does:** Produces six primary and six secondary article drafts per campaign with AI-authored headlines and bodies.
- **How it works:** Workflow steps invoke structured prompts for titles and bodies in batched groups. Outputs are stored in `articles` and `secondary_articles` tables linked to campaigns.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`generatePrimaryTitles`, `generatePrimaryBodiesBatch1`, `generateSecondaryBodiesBatch2`); `src/lib/openai.ts` (`AI_CALL.primaryTitles`, `AI_CALL.primaryBodies`, `AI_CALL.secondaryBodies`); `src/app/api/debug/test-article-generation/route.ts`.
- **Database Tables:** `articles`, `secondary_articles`, `rss_posts`, `post_ratings`, `newsletter_campaigns`.
- **Connections:** Article content feeds the fact-checking feature, welcome-section summarization, preview pages, and final email rendering. Manual toggles and edits operate on these generated records.

### AI Fact-checking Gate
- **What it does:** Validates generated articles to ensure factual accuracy before publishing.
- **How it works:** Dedicated workflow steps send article/source pairs to AI fact-check prompts, storing scores and reasoning. Articles failing thresholds can be flagged for manual review.
- **Key Files / Functions:** `src/lib/workflows/process-rss-workflow.ts` (`factCheckPrimary`, `factCheckSecondary`); `src/lib/openai.ts` (`AI_CALL.primaryFactCheck`, `AI_CALL.secondaryFactCheck`); `src/app/api/debug/verify-criteria-columns/route.ts`.
- **Database Tables:** `articles`, `secondary_articles`, `fact_check_logs`, `newsletter_campaigns`.
- **Connections:** Fact-check results surface in dashboards, influence readiness status, and factor into subject line or welcome updates when articles are replaced.

### Automated Welcome Section Generation
- **What it does:** Writes a conversational newsletter introduction summarizing selected stories.
- **How it works:** Uses the `ai_prompt_welcome_section` prompt, inserting active primary and secondary articles to generate text stored on the campaign. Regeneration endpoints trigger when article selections change.
- **Key Files / Functions:** `src/app/api/campaigns/[id]/regenerate-welcome/route.ts` (`POST`); `src/lib/openai.ts` (`AI_CALL.welcomeSection`, `callWithStructuredPrompt`); `src/app/api/ai/load-prompt/route.ts` (`GET` for prompt defaults).
- **Database Tables:** `newsletter_campaigns` (`welcome_intro`, `welcome_tagline`, `welcome_summary`), `articles`, `secondary_articles`, `app_settings`.
- **Connections:** Appears in email previews and depends on article selection, AI prompt management, and campaign workflows. Manual edits in admin dashboards override generated content if needed.

### Dynamic Subject Line Generation
- **What it does:** Produces and refreshes email subject lines based on top-ranked articles.
- **How it works:** API routes call AI prompts using current primary article ordering. Regeneration triggers automatically when article rankings shift or manually via admin controls.
- **Key Files / Functions:** `src/app/api/campaigns/[id]/generate-subject/route.ts` (`POST`); `src/app/api/cron/generate-subject/route.ts`; `src/lib/openai.ts` (`AI_CALL.subjectLineGenerator`); `src/lib/subject-line-generator.ts` (`generateSubjectLineForCampaign`).
- **Database Tables:** `newsletter_campaigns` (`subject_line`, `subject_line_history`), `articles`, `post_ratings`, `user_activities`.
- **Connections:** Tightly coupled with scoring engine, campaign lifecycle, and MailerLite send readiness. Subject lines are logged for analytics and performance tracking.

### Manual Article Management
- **What it does:** Enables editors to add, toggle, reorder, or skip articles within each campaign.
- **How it works:** Admin UI exposes CRUD operations on manual articles and switches on generated pieces. Updates propagate through Supabase mutations and trigger downstream regeneration hooks where needed.
- **Key Files / Functions:** `src/app/api/articles/manual/route.ts` (`GET`, `POST`); `src/app/api/campaigns/[id]/articles/toggle/route.ts`; `src/app/api/campaigns/[id]/articles/reorder/route.ts`; `src/app/dashboard/[slug]/campaigns/[id]/components/ArticleList.tsx`.
- **Database Tables:** `manual_articles`, `articles`, `secondary_articles`, `user_activities`, `newsletter_campaigns`.
- **Connections:** Manual adjustments influence subject lines, welcome section copy, and final email content. They are tracked within campaign history for audit/debug endpoints.

### AI Apps Directory
- **What it does:** Catalogs AI tools relevant to newsletter audiences with full CRUD management.
- **How it works:** Database tables for AI applications and prompt ideas are exposed via REST APIs and admin pages. Upload endpoints handle logos, while selection metadata links apps to campaigns when featured.
- **Key Files / Functions:** `src/app/api/ai-apps/route.ts` (`GET`, `POST`); `src/app/api/ai-apps/[id]/route.ts` (`PATCH`, `DELETE`); `src/app/api/ai-apps/upload/route.ts`; `src/app/dashboard/[slug]/settings/ai-apps/page.tsx`; `src/lib/app-selector.ts` (`selectAppsForCampaign`).
- **Database Tables:** `ai_applications`, `ai_application_uploads`, `campaign_ai_apps`, `app_settings`.
- **Connections:** Shares components with prompt management, appears in campaign previews, and can be referenced in welcome/introduction copy or ads.

### Centralized AI Prompt Management
- **What it does:** Centralizes editing, testing, and versioning of AI prompts used throughout the system.
- **How it works:** Settings pages load prompts from `app_settings`, allow inline edits, testing via debug APIs, and structured prompt JSON support. Migration scripts keep defaults synchronized.
- **Key Files / Functions:** `src/app/api/ai/load-prompt/route.ts`, `save-prompt/route.ts`, `test-prompt/route.ts`, `test-prompt-multiple/route.ts`; `src/app/api/ai/load-prompt-template/route.ts`; `src/app/dashboard/[slug]/settings/ai-prompts/page.tsx`; `src/lib/openai.ts` (`callWithStructuredPrompt`, `AI_PROMPTS`).
- **Database Tables:** `app_settings`, `prompt_templates`, `prompt_test_logs`.
- **Connections:** Powers all AI-driven features (articles, welcome, subject lines, scoring). Changes cascade to workflows immediately, so audit tools log edits for traceability.

### Advertisement Management
- **What it does:** Collects advertiser submissions, processes payments, and schedules approved placements in newsletters.
- **How it works:** Public submission forms feed Supabase tables, payment verification occurs via Stripe webhooks, and admins approve ads to assign positions. Scheduler ensures ads appear in the correct campaign layout.
- **Key Files / Functions:** `src/app/ads/submit/page.tsx` (intake form); `src/app/api/ads/route.ts` (`POST` submission); `src/app/api/ads/[id]/approve/route.ts`, `reject/route.ts`, `activate/route.ts`; `src/app/api/ads/verify-payment/route.ts`; `src/lib/ad-scheduler.ts` (`scheduleCampaignAds`, `assignBackupAds`).
- **Database Tables:** `advertisements`, `ad_orders`, `campaign_ads`, `ad_assets`, `payments`.
- **Connections:** Campaign rendering consumes active ads, link tracking monitors performance, and Slack notifications alert staff to pending approvals.

### Polls System
- **What it does:** Allows creation of audience polls with response tracking and analytics.
- **How it works:** Admins configure polls, activate them for campaigns, and collect responses via dedicated endpoints. Analytics pages aggregate results for review.
- **Key Files / Functions:** `src/app/api/polls/route.ts` (`GET`, `POST`); `src/app/api/polls/[id]/route.ts` (`PATCH`, `DELETE`); `src/app/api/polls/[id]/responses/route.ts`; `src/app/dashboard/polls/page.tsx`; `src/app/api/polls/active/route.ts`.
- **Database Tables:** `polls`, `poll_responses`, `newsletter_campaigns`, `user_activities`.
- **Connections:** Poll entries appear in newsletter content and dashboards. Poll metadata can influence subject line copy or welcome text referencing audience engagement.

### Subscriber Feedback Capture
- **What it does:** Gathers qualitative feedback from readers and surfaces gratitude/confirmation flows.
- **How it works:** Feedback endpoints accept responses tied to campaigns, store them with metadata, and send users to thank-you pages. Analytics APIs expose aggregated sentiments.
- **Key Files / Functions:** `src/app/api/feedback/track/route.ts` (`GET`); `src/app/api/feedback/analytics/route.ts`; `src/app/feedback/thank-you/page.tsx`; `src/app/feedback/error/page.tsx`.
- **Database Tables:** `feedback_responses`, `newsletter_campaigns`, `mailerlite_events`.
- **Connections:** Feedback insights inform analytics dashboards, Slack alerts, and future content adjustments. Campaign status pages display feedback summaries for editors.

### Link Tracking and Performance Analytics
- **What it does:** Tracks email link clicks and imports MailerLite performance data for reporting.
- **How it works:** Redirect endpoints log click events before forwarding to targets. Cron jobs call MailerLite APIs to import open/click metrics and store them against campaigns and articles.
- **Key Files / Functions:** `src/app/api/link-tracking/click/route.ts` (`GET`); `src/app/api/link-tracking/analytics/route.ts`; `src/app/api/cron/import-metrics/route.ts`; `src/lib/mailerlite.ts` (`importCampaignMetrics`, `fetchCampaignReport`); `src/app/dashboard/[slug]/analytics/page.tsx`.
- **Database Tables:** `link_clicks`, `email_metrics`, `newsletter_campaigns`, `articles`, `campaign_ads`.
- **Connections:** Analytics dashboards display these metrics, influencing editorial strategies, advertiser reporting, and subject line optimization loops.

### Public Website and Newsletter Archive
- **What it does:** Hosts the marketing site (`aiaccountingdaily.com`) and archive of published newsletters.
- **How it works:** Next.js routes render static-dynamic hybrid pages pulling from campaign articles and metadata. Archive pages iterate over campaign history with SSR caching.
- **Key Files / Functions:** `src/app/website/page.tsx`, `src/app/website/newsletters/page.tsx`, `src/app/website/newsletter/[date]/page.tsx`; `src/app/api/newsletters/archived/route.ts`; `src/lib/newsletter-templates.ts` (`renderPublicNewsletterHtml`).
- **Standalone Marketing App:** `apps/marketing/` (separate Next.js instance for aiaccountingdaily.com landing pages)
- **Database Tables:** `newsletter_campaigns`, `articles`, `secondary_articles`, `manual_articles`, `newsletter_sections`, `archived_articles`.
- **Connections:** Campaign lifecycle completion publishes entries to the archive, and manual edits in admin dashboards reflect on the public site. Link tracking leverages archive URLs.

### Comprehensive Admin Settings
- **What it does:** Provides granular configuration panels for scoring weights, prompts, email settings, schedules, Slack notifications, branding assets, and more.
- **How it works:** Each settings page reads and writes scoped `app_settings` entries, uploading files where needed (logos, header images). Validation ensures tenant isolation.
- **Key Files / Functions:** `src/app/dashboard/[slug]/settings/page.tsx`; `src/app/dashboard/[slug]/settings/criteria/page.tsx`; `src/app/api/settings/criteria/route.ts`; `src/app/api/settings/email/route.ts`; `src/app/api/settings/upload-business-image/route.ts`; `src/app/api/settings/slack/route.ts`.
- **Database Tables:** `app_settings`, `newsletter_settings`, `images`, `business_profiles`, `email_settings`.
- **Connections:** Settings directly affect AI behavior, campaign workflows, advertisement display, and external integrations. Cron jobs read schedule configurations from these values.

### Image Ingestion and Review Utilities
- **What it does:** Manages image uploads, ingestion from source content, deduplication, and reverse-lookup verification.
- **How it works:** API routes process uploads, store metadata (including GitHub-hosted URLs), and provide review UIs for editors. Reverse lookup endpoints help avoid repeated assets or copyright issues.
- **Key Files / Functions:** `src/app/api/images/upload-url/route.ts` (`POST`); `src/app/api/images/review/route.ts`; `src/app/api/images/ingest/route.ts`; `src/lib/github-storage.ts` (`uploadToGitHub`, `ensureRepositoryExists`); `src/lib/article-extractor.ts` (`extractPrimaryImage`).
- **Database Tables:** `images`, `image_variants`, `article_images`, `advertisement_images`, `newsletter_campaigns`.
- **Connections:** Articles, advertisements, and public archive pages pull from the curated image library. Cron jobs and workflows rely on image availability before finalizing campaigns.

### Cron and Automation Suite
- **What it does:** Automates recurring tasks such as campaign creation, RSS processing, health checks, and performance metric imports.
- **How it works:** Vercel cron jobs call secured API routes, each executing a focused task with retry logic and logging. Some cron endpoints orchestrate Vercel Workflows for long-running processes.
- **Key Files / Functions:** `src/app/api/cron/create-campaign/route.ts`; `cron/ingest-rss/route.ts`; `cron/process-rss/route.ts`; `cron/send-review/route.ts`; `cron/send-final/route.ts`; `cron/health-check/route.ts`; `cron/import-metrics/route.ts`; `src/lib/workflows/process-rss-workflow.ts`; `src/lib/workflows/reprocess-articles-workflow.ts`.
- **Database Tables:** `cron_jobs`, `newsletter_campaigns`, `workflow_runs`, `system_logs`, `email_metrics`.
- **Connections:** Keeps campaign lifecycle on schedule, triggers AI pipelines, populates analytics, and monitors system health. Relies on settings, prompt configurations, and campaign states.

### Error Monitoring and Debug Tooling
- **What it does:** Provides observability via Slack alerts, log dashboards, and a suite of diagnostic endpoints.
- **How it works:** Errors are captured in `system_logs`, surfaced in dashboards, and, for critical issues, pushed to Slack. Debug endpoints allow inspecting campaigns, articles, AI prompts, and RSS data.
- **Key Files / Functions:** `src/lib/slack.ts` (`SlackNotificationService`, `sendRSSIncompleteAlert`); `src/app/api/notifications/slack/route.ts`; `src/app/api/logs/route.ts`; `src/app/dashboard/logs/page.tsx`; `src/app/api/debug/recent-campaigns/route.ts`; `src/app/api/debug/campaign-articles/route.ts`; `src/app/api/debug/test-ai-prompts/route.ts`.
- **Database Tables:** `system_logs`, `debug_reports`, `newsletter_campaigns`, `articles`, `rss_posts`.
- **Connections:** Supports every feature by enabling rapid troubleshooting. Workflows, cron jobs, and manual UIs reference logs to resolve failures quickly.


