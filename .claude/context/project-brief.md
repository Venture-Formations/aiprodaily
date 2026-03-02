---
created: 2026-03-02T19:21:35Z
last_updated: 2026-03-02T19:21:35Z
version: 1.0
author: Claude Code PM System
---

# Project Brief

## What It Does

AIProDaily is a multi-tenant newsletter automation platform for AI industry newsletters. It ingests RSS feeds, scores and ranks articles using AI, generates newsletter content, and delivers campaigns via MailerLite.

## Why It Exists

To automate the labor-intensive process of curating, writing, and sending daily AI-focused newsletters. The platform replaces manual curation with a 10-step AI-powered workflow while keeping a human-in-the-loop review step before final send.

## Current Newsletters

- **Admin Dashboard:** www.aiprodaily.com
- **Primary Newsletter:** AI Accounting Daily (slug: `accounting`, public site: www.aiaccountingdaily.com)

## Success Criteria

- Reliable daily newsletter generation with minimal manual intervention
- Multi-tenant architecture supporting multiple publications from a single codebase
- High-quality AI-generated content that passes editorial review
- Scalable RSS ingestion across hundreds of feeds
- Revenue via embedded advertorials, sponsorships, and an AI Tools Directory

## Key Stakeholders

- Newsletter editors (review and approve content via dashboard)
- Advertisers (self-service ad management via account portal)
- Subscribers (receive the newsletter via MailerLite)

## Repository

- GitHub: `Venture-Formations/aiprodaily`
- Branch: `master` (production, auto-deploys to Vercel)
- Workflow: feature branches with PRs
