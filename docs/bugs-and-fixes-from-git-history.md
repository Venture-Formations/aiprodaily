# Bugs and Fixes from Git History

**Sources:** **All git commits on `master`** (full `git log master` — direct pushes and commits that arrived via merged PRs). Vercel deployments for **venture-formations/aiprodaily** (project linked via `vercel link --project aiprodaily`). Pushes to `master` auto-deploy to Vercel production.

**Scope:** The list below includes **every** commit on `master` that is a bug fix or fix-related (not only merge commits or PR titles). Build: `git log master --oneline --no-merges` filtered for fix-like messages (Fix, fix, Revert, Restore, Guard, Harden, Remove…, Simplify, Normalize, etc.).

---

## Vercel deployments

- **Project:** venture-formations/aiprodaily — [www.aiprodaily.com](https://www.aiprodaily.com)
- **List:** `npx vercel list --yes` (paginate with `--next <cursor>`)
- **Production deployments** (recent): Multiple production builds on **2026-02-27** (09:04–15:32 CST); also production builds **4d** and **5d** ago (Feb 26–25). Preview deployments every few hours on branch activity.

### Deployments → fixes shipped

Correlation by deployment date (from `vercel inspect` created timestamps and git history). Each production deploy includes all fixes merged to `master` up to that deploy.

| Deployment date | Production URL (example) | Fixes included (from list below) |
|-----------------|---------------------------|-----------------------------------|
| **2026-02-27** (current prod) | [aiprodaily-dvan2wqgi](https://aiprodaily-dvan2wqgi-venture-formations.vercel.app) | All fixes through **a788712** (merge of staging into master): SparkLoop dashboard no-data fix, issue date logic (tomorrow Central), CodeQL blob guard, review send (slug/catch-up/date), review email scheduledSendTime, JSON-LD logo URL, prompt module query/render, preheader fallback, feedback phantom votes/wrong key/module not showing, build downlevelIteration, SparkLoop chart duplicates & New Pending inflation, rec card table layout, mobile layout, Google/AdSense compliance, seed.sql quotes, and all earlier fixes. |
| **2026-02-26** (4d ago) | aiprodaily-7utsetf2q, 9y918u67l, 9xfeayug9, aqqd42wqh, plccvffxi | Same as above (staging merge and refactor/god-files fixes). |
| **2026-02-25** (5d ago) | aiprodaily-fu55zh3wz | Fixes through **Feb 23–24**: Google policy compliance, SparkLoop chart/rec card/mobile, seed.sql, ad image_alt, migration endpoint, honeypot, campaign naming, test email, footer copy, issue page crash, MailerLite unsubscribe/group ID, ESLint/build, Supabase storage, image alt, CVE, two-step campaign content, date filter CST/UTC. |
| **2026-02-23–24** | (previews) | Google policy, SparkLoop fixes, refactors; staging merge. |
| **2026-02-18–20** | (earlier prod) | CVE, lint/build, MailerLite group ID, storage, image alt, honeypot, campaign naming, test email, footer, ad image_alt, migration hardening, Supabase branching. |
| **2026-02-17** | (earlier prod) | Campaign content restore, two-step flow, date filter CST/UTC, MailerLite/CAN-SPAM, SparkLoop Publications tab & pagination. |

*To see exact commit for a deployment, use Vercel dashboard or API with deployment id and git metadata.*

The **fixes listed below** are from git history; the table above shows **which of those fixes shipped** in each deployment window.

---

## Bugs and fixes from git history (by area)

### SparkLoop
- [058e13a] Fix SparkLoop dashboard showing no data: graceful degradation and error visibility
- [6fca0ae] Fix SparkLoop chart: pagination duplicates and X-axis timezone offset
- [2effc5d] Fix SparkLoop New Pending count inflation from newly-synced recommendations
- [e01a0b6] Fix SparkLoop New Pending count inflation from newly-synced recommendations
- [1a9c20f] Fix SparkLoop chart: pagination duplicates and X-axis timezone offset
- [e3ec316] Fix SparkLoop rec card: use table layout with button below text for email compatibility
- [075f4f3] Add Supabase branching for preview deployments and fix SparkLoop mobile layout
- [4c0768b] Fix missing prompt selection logging and add SparkLoop rec selection to create-with-workflow
- [292e5c4] Center subscribe button on SparkLoop recommendation cards
- [69e1e51] Remove dead Settings > RSS Feeds tab and auto-create feedback module
- [192472f] Filter SparkLoop submissions by CST day boundaries instead of UTC
- [535583a] Switch Publications tab dates from UTC to CST to match SparkLoop dashboard
- [5ea29c8] Add pagination to SparkLoop API queries to prevent silent data truncation
- [37724e8] Normalize Gmail addresses for SparkLoop API to fix referral matching
- [dc338bc] Fix SparkLoop offer submission ID format for HubSpot conversion tracking
- [4ac6b74] Add SparkLoop module click tracking, bot/IP filtering, and fix section design
- [13fccd8] Simplify SparkLoop sync: trust recommendations API for paused status
- [a1a3251] Fix new pending calc: delta_pending + delta_confirms + delta_rejections
- [903dc8d] Fix pagination, comma formatting, tooltip earnings, and clamp new pending
- [d7ab5fa] Fix Total Earnings to show confirms only, bar labels show combined total
- [a628149] Separate popup/page CR tracking, fix override priority, and rewrite referral chart
- [b17627e] Remove + prefix from New Pending labels
- [385c77f] Revert generate-based pausing, keep generate call for diagnostics only
- [dd6b3a2] Remove generate endpoint call from sync entirely
- [92bce40] Make CR/RCR overrides true overrides with red indicator when real data exists
- [8167b7d] Simplify button block: custom DB text or static fallback
- [628b02b] Remove View/Edit link from Product Cards blocks
- [b49a3cc] Remove skip link from offers page
- [f945323] Fix subscribe flow and update redirect destinations

### MailerLite
- [925c665] Fix review email not sending: use scheduledSendTime instead of issueCreationTime
- [49eff75] Fix MailerLite main group ID not persisting across saves
- [9e6018d] Add hidden {$unsubscribe} link for MailerLite compliance
- [6b21c49] Fix MailerLite field update for SparkLoop subscribers
- [a318012] Fix MailerLite field name case: SparkLoop -> sparkloop
- [1eb3e7a] Fix MailerLite subscriber lookup filter format

### Cron
- [2cfa47a] Fix review send: remove hardcoded slug, add catch-up mechanism, fix date calc
- [1d2441a] Harden webhook replay protection and enforce system auth on all cron routes

### Auth
- [c9ee463] Remove pervasive auth bypass in favor of explicit ALLOW_AUTH_BYPASS env var
- [1d2441a] Harden webhook replay protection and enforce system auth on all cron routes

### Build / ESLint / CodeQL
- [68ebaab] Guard image preview URLs to only allow blob: protocol (CodeQL fix)
- [9c3ab5c] Fix CodeQL and code-quality CI findings in rss-processor modules
- [1185df8] Fix unused variables flagged by code quality checks
- [f647642] Fix build: use Array.from() instead of for-of on Map to avoid downlevelIteration error
- [6ea21ff] Fix all ESLint errors blocking production build
- [bbe1e55] Skip ESLint during Next.js build (run separately via npm run lint)
- [2c93009] Fix lint warnings and migrate ad image uploads to Supabase Storage
- [6cbfc6d] Fix code quality: remove unused import, use proper URL hostname parsing for sanitization
- [2f99084] Fix React Server Components CVE vulnerabilities
- [19d98a0] Fix issue page crash caused by ESLint module->mod rename

### Ads
- [2086af3] Fix ad image_alt not persisting on save
- [a21f1bd] fix(website): replace AdSense CCPA bar with footer link
- [04b2467] Fix Google spam & AdSense policy compliance

### Campaign / Issue
- [cc02fad] Fix issue date logic: always use tomorrow in Central Time
- [65818a7] Fix prompt module query: remove non-existent created_at column from issue_prompt_modules
- [1ba017d] Fix prompt module not rendering: wrong column name in fetchPromptSelections
- [e25a888] Fix preheader text: fall back to subject_line when welcome_summary is empty
- [ec49cbc] Fix campaign naming: use publications.slug instead of broken join
- [679af17] Fix test campaign name using newsletter_name from publication_settings
- [73321ad] Restore content in POST, make content endpoint non-fatal fallback
- [38af09c] Restore two-step campaign flow: shell POST + content PUT
- [992e4a8] Fix campaign content: restore content in POST, remove invalid content endpoint
- [95bd7c8] Remove content from campaign POST to fix two-step content flow
- [b0bb37b] Fix status column sorting to use badge label text
- [df11e41] Remove [TEST] prefix from email subject line
- [5ffb75c] Change 'Manage Preferences' to 'Get Fewer Emails' in newsletter footer

### Multi-tenant / Publication
- [d9bc8d3] Fix JSON-LD logo URL when logo_url is a full external URL

### Feedback / Analytics
- [81f75ba] Raise phantom 5-star votes from 5 to 10 on feedback results page
- [f70666b] Fix feedback analytics API returning wrong key for module
- [c7b3318] Fix feedback module not showing in Settings > Sections
- [dd3f578] Fix feedback module width to match other newsletter sections
- [731b1e3] Fix feedback results showing N/A for issue dates and add IP exclusion
- [e036305] Fix timezone issue in feedback date display
- [13f0c10] Add feedback exclusion debug endpoint and fix exclusion_source in GET
- [3f2ffd6] Fix feedback comments read endpoint to work without auth
- [4a85eee] Fix feedback unread badge to work without authentication

### Cleanup / Dead code
- [4ab234b] Remove stale test-new-deduplicator route.ts.old file
- [6a75539] Delete 47 dead debug routes and document triage results

### Snapshot / Render
- [a86759b] Add per-fetch error isolation and fix comment accuracy in snapshot rendering

### Database / Seed
- [c88b27e] Fix seed.sql: remove extraneous quotes from numeric setting values

### Media / Image uploads
- [f4aabe8] Fix migration endpoint and harden image upload routes

### Website / Security
- [23596f4] Fix honeypot link to redirect to homepage instead of example.com
- [c3bcb88] Make date filter respect CST/UTC timezone toggle
- [32abccf] Remove redundant timezone note from Publications tab
- [a012bca] Fix date display in Publications tab to use UTC

---

## Chronological list (newest first, with date when known)

| Date       | Hash     | Summary |
|------------|----------|--------|
| (recent)   | 058e13a  | Fix SparkLoop dashboard showing no data: graceful degradation and error visibility |
| (recent)   | cc02fad  | Fix issue date logic: always use tomorrow in Central Time |
| (recent)   | 68ebaab  | Guard image preview URLs to only allow blob: protocol (CodeQL fix) |
| (recent)   | 4ab234b  | Remove stale test-new-deduplicator route.ts.old file |
| (recent)   | 2cfa47a  | Fix review send: remove hardcoded slug, add catch-up mechanism, fix date calc |
| (recent)   | 925c665  | Fix review email not sending: use scheduledSendTime instead of issueCreationTime |
| (recent)   | d9bc8d3  | Fix JSON-LD logo URL when logo_url is a full external URL |
| (recent)   | 65818a7  | Fix prompt module query: remove non-existent created_at column from issue_prompt_modules |
| (recent)   | 1ba017d  | Fix prompt module not rendering: wrong column name in fetchPromptSelections |
| (recent)   | e25a888  | Fix preheader text: fall back to subject_line when welcome_summary is empty |
| (recent)   | 9c3ab5c  | Fix CodeQL and code-quality CI findings in rss-processor modules |
| (recent)   | a21f1bd  | fix(website): replace AdSense CCPA bar with footer link |
| (recent)   | 4c0768b  | Fix missing prompt selection logging and add SparkLoop rec selection to create-with-workflow |
| (recent)   | 6a75539  | Delete 47 dead debug routes and document triage results |
| (recent)   | 1d2441a  | Harden webhook replay protection and enforce system auth on all cron routes |
| (recent)   | c9ee463  | Remove pervasive auth bypass in favor of explicit ALLOW_AUTH_BYPASS env var |
| (recent)   | a86759b  | Add per-fetch error isolation and fix comment accuracy in snapshot rendering |
| (recent)   | 1185df8  | Fix unused variables flagged by code quality checks |
| 2026-02-24 | 81f75ba  | Raise phantom 5-star votes from 5 to 10 on feedback results page |
| 2026-02-24 | f70666b  | Fix feedback analytics API returning wrong key for module |
| 2026-02-24 | c7b3318  | Fix feedback module not showing in Settings > Sections |
| 2026-02-23 | f647642  | Fix build: use Array.from() instead of for-of on Map to avoid downlevelIteration error |
| 2026-02-23 | 6fca0ae  | Fix SparkLoop chart: pagination duplicates and X-axis timezone offset |
| 2026-02-23 | 2effc5d  | Fix SparkLoop New Pending count inflation from newly-synced recommendations |
| 2026-02-23 | 1a9c20f  | Fix SparkLoop chart: pagination duplicates and X-axis timezone offset |
| 2026-02-23 | e01a0b6  | Fix SparkLoop New Pending count inflation from newly-synced recommendations |
| 2026-02-23 | c88b27e  | Fix seed.sql: remove extraneous quotes from numeric setting values |
| 2026-02-23 | 292e5c4 | Center subscribe button on SparkLoop recommendation cards |
| 2026-02-23 | e3ec316  | Fix SparkLoop rec card: use table layout with button below text for email compatibility |
| 2026-02-23 | 075f4f3  | Add Supabase branching for preview deployments and fix SparkLoop mobile layout |
| 2026-02-23 | 04b2467  | Fix Google spam & AdSense policy compliance |
| 2026-02-20 | f4aabe8  | Fix migration endpoint and harden image upload routes |
| 2026-02-20 | 6cbfc6d  | Fix code quality: remove unused import, use proper URL hostname parsing for sanitization |
| 2026-02-20 | 2086af3  | Fix ad image_alt not persisting on save |
| 2026-02-19 | 23596f4  | Fix honeypot link to redirect to homepage instead of example.com |
| 2026-02-19 | ec49cbc  | Fix campaign naming: use publications.slug instead of broken join |
| 2026-02-19 | df11e41  | Remove [TEST] prefix from email subject line |
| 2026-02-19 | 679af17  | Fix test campaign name using newsletter_name from publication_settings |
| 2026-02-19 | 5ffb75c  | Change 'Manage Preferences' to 'Get Fewer Emails' in newsletter footer |
| 2026-02-19 | 19d98a0  | Fix issue page crash caused by ESLint module->mod rename |
| 2026-02-18 | 9e6018d  | Add hidden {$unsubscribe} link for MailerLite compliance |
| 2026-02-18 | 6ea21ff  | Fix all ESLint errors blocking production build |
| 2026-02-18 | 49eff75  | Fix MailerLite main group ID not persisting across saves |
| 2026-02-18 | bbe1e55  | Skip ESLint during Next.js build (run separately via npm run lint) |
| 2026-02-18 | 2c93009  | Fix lint warnings and migrate ad image uploads to Supabase Storage |
| 2026-02-18 | 2f99084  | Fix React Server Components CVE vulnerabilities |
| 2026-02-17 | c3bcb88  | Make date filter respect CST/UTC timezone toggle |
| 2026-02-17 | 73321ad  | Restore content in POST, make content endpoint non-fatal fallback |
| 2026-02-17 | 38af09c  | Restore two-step campaign flow: shell POST + content PUT |
| 2026-02-17 | 992e4a8  | Fix campaign content: restore content in POST, remove invalid content endpoint |
| 2026-02-17 | 95bd7c8  | Remove content from campaign POST to fix two-step content flow |
| (older)    | b0bb37b  | Fix status column sorting to use badge label text |

### Older fixes (from full git history, all commits to master)

- [bf44302] Fix SparkLoop sync to paginate through all recommendations
- [f55a079] Fix SparkLoop sync auth to allow browser-initiated calls
- [2837044] Fix SparkLoop budget lookup and treat missing budget as $0
- [213f26e] Fix budget lookup to try both partner_program_uuid and rec.uuid
- [c86a7a0] Fix paused detection with safety threshold to prevent mass false-pauses
- [4ac5ffa] Fix paused detection with name-verified UUID matching
- [87205ef] Fix default CR display to 22% to match score calculation
- [2bf948e] Fix score sorting: treat 0% RCR as no-data and sort by score
- [1f6e763] Fix SparkLoop referral attribution: pass subscriber_uuid and extract webhook ref_code
- [b7ca106] Fix company Used count to sum all ad times_used in module
- [0082257] Fix SparkLoop counts to be mutually exclusive
- [7308555] Fix SparkLoop admin counts to include archived/awaiting_approval status
- [2278016] Simplify UUID matching — trust UUIDs without name verification
- [6906843] Revert aggressive budget exclusion, add UUID diagnostics
- [bd85466] Fix SparkLoop paused detection, subscribe validation, and RCR calculation
- [442ca9f] Fix SparkLoop subscribe flow to match documented 3-step Upscribe process
- [5ab79b1] Fix staging user ID to be valid UUID for database
- [f4e79d1] Fix analytics endpoint to use staging user ID for read status
- [98db89d] Fix link clicks missing publication_id for real_click sync
- [e34b207] Fix Real_Click field key and add backfill endpoint
- [a2c64c3] Fix Supabase 1000-row limit by using pagination
- [db7b639] Fix suggestions endpoint also hitting 1000 row limit
- [174f0bd] Fix IP exclusion list showing only 1000 rows, add pagination
- [41c1096] Fix Facebook post to preserve newline spacing from original ad
- [0cf0092] Fix Claude API error by stripping custom fields from prompt config
- [ab40006] Fix pagination issue in IP exclusion suggestions endpoint
- [b7ab2c5] Fix poll response rate showing 0% - use 1 decimal place
- [cb51645] Fix IP suggestions detection - remove failing RPC call
- [4616d5e] Add poll IP exclusion system and fix issue-level response uniqueness
- [f6f1493] Fix escape sequence handling and add debug logging
- [560db30] Fix JSON parsing: escape control characters inside string values
- [5c9c689] Revert "Add JSON Builder mode to Testing Playground for Custom/Freeform prompts"
- [e2792bd] Remove flawed JSON extraction - use simple sanitization only
- [561964f] Fix trailing content after JSON in Testing Playground
- [e03b7c9] Remove backwards compatibility from Text Box - require full API format
- [5f2af8d] Fix JSON parsing to preserve full object structure over arrays
- [f4eb84a] Add URL normalization for ads - remove https:// prefill, auto-add on save
- [63e84e9] Fix module_articles pagination to retrieve all records beyond 1000 row limit
- [8ef9d97] Fix poll selector to use current active poll instead of inactive last-used poll
- [8047e22] Fix PromptSelector to filter by publication_id
- [e375569] Fix subject line prompt placeholder mismatch
- [4d031b0] Fix AI prompts save functionality
- [72c6c2c] Fix test-prompt-multiple to query all modules when no module_id provided
- [329d3eb] Fix AI Prompt Testing to properly query posts from sent issues
- [721dbe6] Fix AI Prompt Testing to use module-specific posts from sent issues
- [72d7f58] Remove text truncation from articles table display
- [ff31c5d] Fix timezone bug in Issue Date display
- [38bdb15] Fix Section column width for long module names
- [f333ff6] Fix Testing Playground article modules and posts loading
- [c56ed98] Fix selected articles count to show sum of article modules max articles
- [778d34c] Fix Subject Line prompt loading - use correct API endpoint
- [2a40960] Refactor settings UI and fix AI apps email display
- [3e13a1a] Fix AI Apps analytics to include module selections
- [6860d68] Fix click tracking and analytics for new module system
- [fa7cb4c] Fix deduplication to check module_articles for historical duplicates
- [bbf6c94] Fix Create New Issue button to use module-based selectors
- [0265fdb] Fix paragraph margins in text box blocks for consistent spacing
- [1a50c4c] Fix text box module ordering and reduce block padding
- [d779930] Auto-fix static image pending status on fetch
- [6afbf2e] Fix ambiguous foreign key in text box placeholder query
- [8d7230f] Fix static image blocks showing pending status
- [70961f4] Fix text box module ordering and add debug logging
- [b4c41b9] Fix AI response extraction for text box modules
- [e5b17a6] Fix blocks API to accept snake_case parameter names
- [6460b23] Fix text-box-modules API to accept snake_case publication_id parameter
- [7c1ca63] Fix TypeScript error: rss_post is array when queried directly
- [31c9469] Fix subject line to use #1 article from FIRST article section
- [0442804] Fix campaign API query by removing article_modules join that lacked FK
- [a498f60] Fix campaign API to return module_articles as articles for frontend compatibility
- [a7ce6b7] Fix API routes for welcome and subject line generation to use module_articles
- [c52b8e4] Fix welcome section and subject line generation to use module_articles
- [827d591] Simplify pending tools count to fetch on load only
- [305a6d7] Simplify preference options labels

---

**How this list was built:** `git log master --oneline --no-merges` was scanned for fix-related commit messages (Fix, fix, Revert, Restore, Guard, Harden, Remove…, Simplify, Normalize, correct, prevent, avoid). Every such commit on `master` is included above (by area and in Older fixes). Merge commits are not listed as fixes; the individual commits they brought in are.
