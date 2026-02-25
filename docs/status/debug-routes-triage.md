# Debug Routes Triage

_Completed: 2026-02-25_

## Summary

| Status | Count | Description |
|--------|-------|-------------|
| Deleted | 47 | One-off migrations, deprecated tests, schema verifiers, duplicates |
| Kept | ~144 | Operational diagnostics, recovery actions, active test endpoints |
| Deferred | ~25 | Lower-value but not harmful; candidates for future cleanup |

Total routes dropped from ~197 to ~150.

---

## Deleted Routes (47)

### (ai) — 8 deleted

| Route | Rationale |
|-------|-----------|
| `initialize-ai-prompts/` | One-off seed operation, already run |
| `initialize-breaking-news-prompt/` | Breaking News feature removed from active flows |
| `initialize-criteria-prompts/` | One-off seed operation, already run |
| `init-subject-line-prompt/` | One-off seed operation, already run |
| `delete-outdated-prompt/` | One-off cleanup, already run |
| `setup-secondary-ai-prompts/` | One-off seed operation, already run |
| `split-article-prompts/` | One-off migration, already run |
| `test-prompt/` | Empty shell (route.ts.old only) |

### (campaign) — 2 deleted

| Route | Rationale |
|-------|-----------|
| `init-newsletter-archives/` | One-off DDL setup, already run |
| `setup-secondary-articles/` | One-off DDL setup, already run |

### (checks) — 8 deleted

| Route | Rationale |
|-------|-----------|
| `check-positions/` | Schema verifier for stable schema |
| `check-skip-column/` | Schema verifier for stable schema |
| `check-images-schema/` | Schema verifier for stable schema |
| `verify-criteria-columns/` | Schema verifier for stable schema |
| `verify-multitenant/` | Schema verifier for stable schema |
| `check-colors/` | Hardcoded investigation, no longer needed |
| `check-website-header/` | Hardcoded investigation, no longer needed |
| `investigate-issues/` | Hardcoded UUIDs, one-off investigation |

### (integrations) — 1 deleted

| Route | Rationale |
|-------|-----------|
| `process-webhook-manually/` | Duplicate of `manual-process-webhook/` (older, more verbose version) |

### (maintenance) — 29 deleted

| Route | Rationale |
|-------|-----------|
| `add-custom-default-column/` | Applied DDL migration |
| `add-full-article-text-column/` | Applied DDL migration |
| `add-instagram-settings/` | Applied DDL migration |
| `add-lookback-columns/` | Applied DDL migration |
| `add-newsletter-id-column/` | Applied DDL migration |
| `add-newsletter-id-to-archives/` | Applied DDL migration |
| `add-phase2-statuses/` | Applied DDL migration |
| `add-poll-section/` | Applied DDL migration |
| `add-secondary-article-writer/` | Applied DDL migration |
| `add-skip-column/` | Applied DDL migration |
| `add-website-domain/` | Applied DDL migration |
| `apply-position-migration/` | Applied DDL migration |
| `create-archived-ratings-table/` | Applied DDL migration |
| `migrate-ad-ordering/` | Applied data migration |
| `migrate-ai-prompts/` | Applied data migration |
| `migrate-criteria-settings/` | Applied data migration |
| `migrate-images-to-supabase/` | Applied data migration |
| `sync-newsletter-colors/` | Applied data migration |
| `fix-max-tokens/` | One-off fix, already applied |
| `fix-oct-8-featured/` | One-off fix, hardcoded date |
| `fix-rating-constraint/` | One-off fix, already applied |
| `fix-total-score-column/` | One-off fix, already applied |
| `remove-content-evaluator/` | Deprecated feature removal, already run |
| `setup-advertisements/` | One-off setup, already run |
| `update-subject-line-description/` | One-off update, already applied |
| `update-topic-deduper/` | One-off update, already applied |
| `update-topic-deduper-outputs/` | One-off update, already applied |
| `reset-deduplication/` | Empty shell (no active route.ts) |
| `run-custom-default-migration/` | Empty shell (no active route.ts) |

### (tests) — 7 deleted

| Route | Rationale |
|-------|-----------|
| `test-breaking-news/` | Tests removed Breaking News feature |
| `test-content-evaluator/` | Tests removed content evaluator feature |
| `test-dedup-fix/` | One-off fix verification |
| `test-simple-deduper/` | Superseded by `test-deduper/` |
| `test-visitstcloud/` | Hardcoded data, one-off investigation |
| `test-gpt5/` | One-off model test |
| `test-new-deduplicator/` | Empty shell (route.ts.old only) |

### Root-level — 1 deleted

| Route | Rationale |
|-------|-----------|
| `check-ai-prompts/` | Duplicate of `(checks)/check-ai-prompts/` (same URL, ambiguous resolution) |

---

## Deferred Routes (~25)

Lower-value but not harmful. Candidates for future cleanup.

| Group | Route | Notes |
|-------|-------|-------|
| (checks) | `check-campaign-dates/` | Niche date checker |
| (checks) | `check-campaign-ids/` | Niche ID checker |
| (checks) | `check-historical-dedup/` | Historical dedup investigation |
| (checks) | `check-social-media/` | Social media config checker |
| (checks) | `check-dates/` | Generic date checker |
| (checks) | `check-openai-posts/` | OpenAI-specific post checker |
| (checks) | `check-prompt-value/` | Single prompt value checker |
| (checks) | `check-campaign-relations/` | Campaign relation checker |
| (tests) | `middleware-test/` | Middleware test |
| (tests) | `mobile-cookie-test/` | Mobile cookie test |
| (tests) | `test-perplexity/` | Perplexity API test |
| (tests) | `test-refund/` | Refund flow test |
| (tests) | `test-csv-parsing/` | CSV parsing test |
| (tests) | `test-google-credentials/` | Google credential test |
| (tests) | `test-raw-vision/` | Raw vision API test |
| (tests) | `test-vision-basic/` | Vision basic test |
| (tests) | `test-vision-detailed/` | Vision detailed test |
| (tests) | `test-vision-simple/` | Vision simple test |
| (tests) | `test-promotion/` | Promotion test |
| (tests) | `test-checkout/` | Checkout flow test |
| (tests) | `test-upload-flow/` | Upload flow test |
| (tests) | `test-upload-url/` | Upload URL test |
| (tests) | `test-featured-query/` | Featured query test |
| (tests) | `test-mobile-auth/` | Mobile auth test |
| (tests) | `simple-auth-test/` | Simple auth test |

---

## Kept Routes (~120)

### (ai) — 7 routes

| Route | Purpose |
|-------|---------|
| `ai-apps-status/` | Check AI app selection status |
| `check-article-content/` | Inspect article content quality |
| `check-prompt-provider/` | Verify AI provider configuration |
| `force-ai-apps/` | Force AI app selection for an issue |
| `list-ai-prompts/` | List all configured prompts |
| `manual-select-apps/` | Manually trigger app selection |
| `restore-prompts/` | Restore prompts from backup |

### (campaign) — 15 routes

| Route | Purpose |
|-------|---------|
| `activate-articles/` | Activate articles for an issue |
| `archive-campaign/` | Archive a campaign |
| `archived-articles/` | View archived articles |
| `articles-analysis/` | Analyze article quality |
| `assign-test-ad/` | Assign test ad to campaign |
| `campaign-articles/` | View campaign articles |
| `complete-campaign/` | Mark campaign complete |
| `deactivate-section/` | Deactivate newsletter section |
| `list-sections/` | List newsletter sections |
| `manual-review-send/` | Manually trigger review send |
| `newsletter-sections/` | View newsletter section config |
| `recent-campaigns/` | List recent campaigns |
| `reset-campaign/` | Reset campaign state |
| `schedule-settings/` | View schedule settings |
| `tomorrow-campaign/` | Check tomorrow's campaign |

### (checks) — 42 routes

Operational diagnostics for config, feeds, campaigns, email, and system health. See route listing above for full list.

### (integrations) — 9 routes

| Route | Purpose |
|-------|---------|
| `auth-status/` | Check auth configuration |
| `backfill-real-clicks/` | Backfill real click data |
| `mailerlite-campaign-debug/` | Debug MailerLite campaigns |
| `mailerlite-test/` | Test MailerLite connection |
| `manual-process-webhook/` | Manually process webhook (kept version) |
| `oauth-config/` | Check OAuth configuration |
| `setup-stripe-webhook/` | Setup Stripe webhook |
| `sparkloop-subscribers/` | Check SparkLoop subscribers |
| `sparkloop-upscribes/` | Check SparkLoop upscribes |

### (maintenance) — 11 routes

| Route | Purpose |
|-------|---------|
| `backfill-bot-detection/` | Backfill bot detection data |
| `cleanup-duplicate-sections/` | Clean up duplicate sections |
| `fix-ad-newsletter/` | Fix ad-newsletter associations |
| `fix-all-prompts/` | Fix all prompt configurations |
| `fix-tomorrow-campaign/` | Fix tomorrow's campaign |
| `reset-app-usage/` | Reset app usage counters |
| `reset-daily-flags/` | Reset daily processing flags |
| `reset-pending-submission/` | Reset pending submission state |
| `update-image-urls/` | Update image URLs |
| `update-newsletter-names/` | Update newsletter names |
| `update-section/` | Update section configuration |

### (media) — 5 routes

| Route | Purpose |
|-------|---------|
| `images/` | Image management |
| `image-upload/` | Upload images |
| `process-images/` | Process/optimize images |
| `storage/` | Storage diagnostics |
| `sync-logo/` | Sync logo images |

### (rss) — 6 routes

| Route | Purpose |
|-------|---------|
| `backfill-full-text/` | Backfill full article text |
| `rescore-posts/` | Re-score RSS posts |
| `rss-images/` | RSS image diagnostics |
| `rss-posts-count/` | Count RSS posts |
| `rss-status/` | RSS processing status |
| `trace-rss-processing/` | Trace RSS processing pipeline |

### (tests) — 49 routes

Active test endpoints for AI, MailerLite, RSS, images, app selection, and more. See route listing above for full list.
