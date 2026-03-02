---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Project Overview

## Features

### Core Pipeline
- **RSS Ingestion** -- Cron-driven feed fetcher populates an `rss_posts` pool
- **Multi-criteria AI Scoring** -- Posts scored against configurable criteria (0-10 each), weighted and ranked
- **Article Generation** -- Top posts selected, full articles generated via OpenAI/Claude
- **Subject Line Generation** -- AI-generated subject lines based on top article
- **Campaign Assembly** -- Articles, AI apps, advertorials, polls combined into newsletter issue
- **Review Dashboard** -- Human review/edit before send
- **MailerLite Delivery** -- Final campaign pushed to MailerLite API
- **Secondary Newsletter** -- Optional secondary send with different content

### Module System (Block-Based Sections)
- Prompt Modules, AI App Modules, Ad Modules, Poll Modules, Feedback Modules, Text Box Modules
- Each supports selection modes: sequential, random, priority, manual

### AI Apps & Tools
- **AI App Rotation** -- Affiliate and non-affiliate apps selected per issue with cooldown logic
- **AI Tools Directory** -- Public catalog at `/tools` with submission, claims, admin features

### User & Advertiser Portal
- Self-service ad management at `/account/ads`
- Stripe-integrated billing
- Profile and subscription management

### Marketing Site
- Public-facing website at `/website`

### Analytics
- Link tracking, polls, feedback loops
- MailerLite metrics import
- SparkLoop referral integration

## Integration Points
- **Supabase** -- PostgreSQL database, all queries scoped by `publication_id`
- **OpenAI / Anthropic** -- AI content generation
- **MailerLite** -- Email delivery
- **Stripe** -- Payments
- **GitHub** -- Image hosting (via Octokit)
- **Vercel** -- Hosting, cron jobs, serverless functions
- **Slack** -- Alerting via webhook
