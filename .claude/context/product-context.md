---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Product Context

## Target Users

### Newsletter Editors
- Use the admin dashboard to review AI-generated content
- Can reorder, skip, or edit articles before sending
- Monitor campaign analytics and subscriber metrics

### Advertisers
- Self-service portal for creating and managing ad campaigns
- Stripe-integrated billing for sponsorships and placements
- Track ad performance metrics

### Subscribers
- Receive daily curated AI industry newsletters
- Interact via polls, feedback links, and referral programs (SparkLoop)

## Core Functionality

### Automated Newsletter Pipeline
- RSS ingestion from configured feeds
- AI-powered article scoring against publication-specific criteria
- Automatic content generation (articles, subject lines, welcome sections)
- Human review step before final delivery
- MailerLite campaign assembly and send

### AI Tools Directory
- Public browsable catalog of AI tools at `/tools`
- Tool submissions and ownership claims
- Category-based browsing
- Admin management via dashboard

### Module System
- Dynamic newsletter sections (prompts, AI apps, ads, polls)
- Configurable rotation and selection logic per module type
- Per-issue selections with manual override capability

## Use Cases
1. Daily newsletter curation and generation with minimal manual effort
2. Advertiser self-service for sponsorship placements
3. Public AI tools discovery and submission
4. Multi-publication management from a single platform
