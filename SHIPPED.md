# Shipped Features

Last updated: 2026-03-10

## March 2026

### SparkLoop Dashboard Improvements (March 9)
- Fixed dashboard date scoping and UTC off-by-one error
- Fixed archived SparkLoop recs showing as Active in Detailed tab
- Extracted shared `toLocalDateStr` utility to eliminate 3 duplicate date formatters
- Merged `recNameLookup` into `recLookup` and extracted `MS_PER_DAY` constant
- Fixed SparkLoop stats API UTC date patterns

### Staging Environment Infrastructure (March 4–6)
- Added non-destructive staging refresh with incremental sync script
- Hardened staging refresh scripts against shell injection and TOCTOU attacks
- Overhauled staging refresh with schema+data dump, quick/full modes, and targeted copy script
- Added staging auto-login via CredentialsProvider with runtime provider check
- Added auth bypass on staging/preview environments
- Added full staging environment support with cron kill switch and migration scripts

### SparkLoop Min. Conversions Budget & Attribution (March 4–5)
- Added configurable Min. Conversions Budget setting for SparkLoop
- Fixed SparkLoop confirm/reject attribution using snapshot deltas
- Added mitigation for MailerLite rate limits (429 retry, throttle)

### MailerLite & AfterOffers Integration (March 3–4)
- Added MailerLite `afteroffers_conversion` field update on AfterOffers conversion postback
- Normalized `eventType` and sanitized error logging in afteroffers postback webhook

### Multi-Tenant RSS Feed Isolation (March 3)
- Fixed critical multi-tenant RSS feed isolation bugs
- Added explicit column selection policy
- Replaced unsafe `select('*')` queries with deterministic, explicit column lists
- Added safety check (`maybeSingle()`) for single-row queries
