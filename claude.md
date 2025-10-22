# AI Pros Newsletter Platform - Main Content Repository

**Last Updated:** 2025-01-22
**Primary Source:** This is now the authoritative development document

## 🎯 Project Overview

**AI Pros Newsletter** is a multi-tenant newsletter automation platform designed to manage multiple industry-focused AI newsletters from a single admin dashboard.

### Platform Architecture
- **Admin Dashboard**: [www.aiprodaily.com](https://www.aiprodaily.com)
- **Current Newsletter**: AI Accounting Daily (slug: `accounting`)
- **Public Website**: [www.aiaccountingdaily.com](https://www.aiaccountingdaily.com)
- **Multi-Tenant System**: Slug-based routing allows multiple newsletters from one codebase
- **Future Expansion**: Platform designed to support additional AI industry newsletters

### Technology Stack & MCP Connections

#### Core Infrastructure
- **Supabase**: PostgreSQL database for all newsletter data, campaigns, articles, and user management
- **Vercel**: Serverless hosting, deployment, and cron job execution
- **GitHub**: Image storage repository for newsletter images and assets
- **Next.js 15**: App Router with TypeScript for frontend and API routes

#### AI & Communication Services
- **OpenAI (ChatGPT)**:
  - Article content generation and rewriting
  - Post scoring and evaluation
  - Subject line generation
  - Multi-criteria content assessment
- **MailerLite**:
  - Email campaign delivery
  - Subscriber management
  - Review group campaigns
  - Final campaign scheduling and sending

## 🔒 **SAVE POINT - RSS Processing Optimization Complete** (2025-01-22)
**Git Commit:** `9137c58` - Consolidate evaluation logging to single line format
**System State:** Fully functional with optimized RSS processing and minimal logging
**Working Features:**
- ✅ RSS Processing with 4 Combined Steps (Archive+Fetch, Extract+Score, Generate, Finalize)
- ✅ Subject Line Generation (both AI and manual editing)
- ✅ Automatic Subject Line Regeneration (when #1 article changes via skip/reorder)
- ✅ Real-Time UI Updates (subject line updates instantly without page refresh)
- ✅ Manual Subject Line Editing (no character limits)
- ✅ Campaign workflow (Draft → In Review → Ready to Send → Sent)
- ✅ Skip Article functionality with complete audit trail
- ✅ Preview Loading States (visual feedback during newsletter generation)
- ✅ **NEW: Minimal Logging System** (prevents Vercel function log overflow)
- ✅ **NEW: Combined Step Workflow** (4 steps instead of 7 for efficiency)
- ✅ **NEW: Consolidated Evaluation Logging** (single line format for all criteria)

**Purpose:** Safe restore point with optimized RSS processing that prevents log overflow

## 🆕 Current Session (2025-01-22): RSS Processing Simplification & Log Reduction

### Major Changes Implemented ✅

#### 1. **Combined Step Architecture**
- **Reduced Complexity**: Simplified from 7-step state machine to 4 combined steps
- **Direct Function Calls**: Steps call processor methods directly (no HTTP round-trips)
- **Retry Logic**: Each step retries once on failure before marking campaign as failed
- **Error Tracking**: Detailed error reporting for each step

**4 Combined Steps:**
```
Step 1: Archive + Fetch RSS feeds
Step 2: Extract article text + Score posts
Step 3: Generate newsletter articles
Step 4: Finalize campaign + Send notifications
```

#### 2. **Aggressive Logging Reduction**
- **Problem**: RSS processing was maxing out Vercel function logs (10MB limit)
- **Solution**: Removed 100+ console.log statements throughout RSS processor

**Logging Changes:**
- `processFeed`: Removed 20+ logs per feed, kept only error logs
- `enrichRecentPostsWithFullContent`: Removed all success/progress logging
- `scorePostsForSection`: Removed batch completion and summary logs
- `evaluatePost`: Combined 7+ lines into single line format

**Example Evaluation Log:**
```
Before: 7+ lines per post
Evaluating post with 3 enabled criteria
Evaluating criterion 1: Interest Level (weight: 1.5)
Using database prompt for criteria1Evaluator
Criterion 1 score: 5/10
... (4 more lines)
Total weighted score: 25.5 (max possible: 40)

After: 1 line per post
Criterion 1: 5/10; Criterion 2: 8/10; Criterion 3: 6/10; Total: 25.5 (max: 40)
```

#### 3. **Simplified Process Endpoint**
- **Single Entry Point**: `/api/rss/process` orchestrates all 4 steps
- **Sequential Execution**: Each step completes before next begins
- **Failure Handling**: Campaign marked as failed if any step fails twice
- **Minimal Output**: Only `[RSS]` prefixed essential messages

### Files Modified This Session

```
# New Combined Step Files
src/app/api/rss/combined-steps/step1-archive-fetch.ts    # Archive old data + fetch RSS
src/app/api/rss/combined-steps/step2-extract-score.ts     # Extract text + score posts
src/app/api/rss/combined-steps/step3-generate.ts          # Generate articles
src/app/api/rss/combined-steps/step4-finalize.ts          # Finalize + notifications

# Updated Process Endpoint
src/app/api/rss/process/route.ts                          # Simplified to call combined steps

# Logging Reduction
src/lib/rss-processor.ts                                  # Massive logging reduction
vercel.json                                               # Set maxDuration to 600 seconds
```

## ⚠️ CRITICAL DEVELOPMENT RULES

### Confidence and Clarification Policy
**When uncertain or confidence is below 80%, always ask the user for clarification:**
- ❌ **NEVER** proceed with assumptions when uncertain about requirements, implementation approach, or potential impacts
- ✅ **ALWAYS** ask for clarification, guidance, or more context when confidence is below 80%
- ✅ **PREFER** multiple choice format when asking for clarification to make decisions easier
- ✅ Present 2-4 concrete options with pros/cons to help user make informed decisions

**Example - Multiple Choice Clarification:**
```
I'm not certain about the best approach for handling X. Here are the options:

A) Approach 1: [Description]
   Pros: [List benefits]
   Cons: [List drawbacks]

B) Approach 2: [Description]
   Pros: [List benefits]
   Cons: [List drawbacks]

Which approach would you prefer, or would you like me to explain any option in more detail?
```

### Date/Time Handling Policy
**ALL date and time operations MUST use local (non-UTC) comparisons:**
- ❌ **NEVER** use `.toISOString()`, `.toUTCString()`, or UTC-based Date methods for date comparisons
- ✅ **ALWAYS** extract date strings directly (e.g., `date.split('T')[0]`) to avoid timezone shifts
- ✅ **ALWAYS** use local time for filtering, sorting, and displaying dates
- ✅ When comparing dates, use string comparison on YYYY-MM-DD format without timezone conversion

**Why:** UTC conversion causes dates to shift forward/backward depending on timezone, breaking filters and comparisons.

## 🔧 Technical Configuration

### Multi-Tenant System
- **Slug-Based Routing**: Each newsletter has unique slug (e.g., "accounting")
- **Subdomain Support**: Public websites use subdomain or custom domain
- **Shared Codebase**: All newsletters run from single Next.js application
- **Database Isolation**: Newsletter data separated by slug/newsletter_id

### Email Settings (AI Accounting Daily)
- **Sender Name**: "AI Accounting Daily"
- **From Email**: Configured in MailerLite settings
- **Subject Format**: AI-generated headlines (no emoji prefix for this newsletter)
- **Domain**: Authenticated and verified in MailerLite

### AI Prompt Requirements
- **Style**: Professional industry newsletter voice
- **Content Focus**: AI developments relevant to accounting professionals
- **Scoring Criteria**: Customizable multi-criteria evaluation system
- **Article Generation**: AI rewrites RSS content for newsletter format

### Content Processing Rules
- **RSS Feeds**: Multiple feeds per newsletter, organized by section (primary/secondary)
- **Article Scoring**: Multi-criteria AI evaluation (customizable weights)
- **Email Format**: HTML email templates with responsive design
- **Article Order**: Sorted by AI score (highest first)

## 🤖 Automated Newsletter Scheduling System

### Schedule Configuration (Central Time)
All times are configurable via Settings > Email tab:

1. **RSS Processing**: Creates tomorrow's campaign + fetches/scores articles
2. **Article Generation**: AI generates newsletter content
3. **Review Campaign**: Creates and schedules review campaign for testing
4. **Final Send**: MailerLite sends to main subscriber list

### Settings Page Integration
- **Email Tab**: Configure all scheduling times
- **MailerLite Settings**: Review Group ID, From Email, Sender Name
- **API Keys**: Stored securely in environment variables
- **Times Configurable**: All cron schedules adjustable via web interface
- **Settings Storage**: `app_settings` table in Supabase

### Automation Features
- **Smart Status Checking**: Only processes campaigns in appropriate status
- **Error Handling**: Comprehensive logging and status updates
- **Idempotent**: Safe to run multiple times, won't duplicate work
- **Manual Testing**: GET endpoints with secret parameter for debugging
- **Slack Notifications**: RSS processing completion alerts

## 📊 Database Schema Overview

### Core Tables
- **newsletter_campaigns**: Campaign metadata, status, dates
- **articles**: Primary section articles with scores and rankings
- **secondary_articles**: Secondary section articles
- **rss_posts**: Raw RSS feed data with full article text
- **rss_feeds**: RSS feed sources (active/inactive, section assignment)
- **post_ratings**: AI evaluation scores for each post
- **archived_articles**: Historical article data
- **archived_rss_posts**: Historical RSS post data
- **app_settings**: Application configuration (AI prompts, email settings, etc.)
- **user_activities**: Audit trail for campaign actions

### Campaign Deletion Tables
When deleting a campaign, the following tables must be cleaned up:
```
1. articles
2. secondary_articles
3. rss_posts
4. post_ratings (cascade from rss_posts)
5. user_activities
6. archived_articles
7. archived_rss_posts
8. newsletter_campaigns (parent table)
```

## 🔍 Key Features by Area

### RSS Processing
- ✅ Multi-feed support with section assignment
- ✅ Facebook image re-hosting to GitHub
- ✅ Full article text extraction
- ✅ Multi-criteria AI scoring
- ✅ Duplicate detection and grouping
- ✅ 24-hour lookback window
- ✅ Minimal logging to prevent overflow

### Campaign Management
- ✅ Draft → In Review → Ready to Send → Sent workflow
- ✅ Skip articles with automatic subject line regeneration
- ✅ Reorder articles with drag-and-drop
- ✅ Manual article editing and addition
- ✅ Preview generation with loading states
- ✅ Complete campaign deletion with error tracking

### Subject Line Generation
- ✅ AI-generated based on top article
- ✅ Manual editing capability
- ✅ Automatic regeneration when #1 article changes
- ✅ Real-time UI updates without page refresh
- ✅ Custom AI prompt configuration

### AI Prompt Customization
- ✅ Database-stored prompts (editable via UI)
- ✅ Custom defaults with double confirmation
- ✅ Test prompts with realistic data
- ✅ Smart reset (custom default → code default)
- ✅ Multi-criteria evaluation system

## 🛠️ Debug Tools & Endpoints

### Campaign Management
- `/api/debug/recent-campaigns` - List recent campaigns with details
- `/api/debug/campaign-articles?campaign_id=X` - Show all articles for campaign
- `/api/debug/complete-campaign` - Fix interrupted campaigns
- `/api/debug/check-campaign-relations` - Diagnose deletion issues

### RSS Processing
- `/api/debug/trace-rss-processing` - Detailed RSS processing logs
- `/api/debug/check-posts` - Verify RSS post data
- `/api/debug/rss-posts-count` - Count posts by campaign
- `/api/debug/activate-articles` - Manually activate top articles

### AI & Prompts
- `/api/debug/test-ai-prompts` - Test prompt output
- `/api/debug/check-ai-prompts` - Verify prompt configuration
- `/api/debug/test-subject-generation` - Test subject line generation
- `/api/debug/test-multi-criteria` - Test multi-criteria scoring

### Settings & Configuration
- `/api/debug/schedule-settings` - View cron schedule configuration
- `/api/debug/check-email-settings` - Verify MailerLite settings
- `/api/debug/check-env-vars` - Verify environment variables

### Key Debug URLs (Production)
- **Recent Campaigns**: `https://www.aiprodaily.com/api/debug/recent-campaigns`
- **Campaign Articles**: `https://www.aiprodaily.com/api/debug/campaign-articles?campaign_id=X`

## 📁 Key Files & Architecture

### API Routes
```
# Campaign Management
src/app/api/campaigns/[id]/route.ts                  # Campaign CRUD
src/app/api/campaigns/[id]/delete/route.ts           # Complete campaign deletion
src/app/api/campaigns/[id]/status/route.ts           # Status workflow updates
src/app/api/campaigns/[id]/preview/route.ts          # Newsletter preview generation

# RSS Processing
src/app/api/rss/process/route.ts                     # Main RSS processing endpoint
src/app/api/rss/combined-steps/step1-archive-fetch.ts
src/app/api/rss/combined-steps/step2-extract-score.ts
src/app/api/rss/combined-steps/step3-generate.ts
src/app/api/rss/combined-steps/step4-finalize.ts

# Article Management
src/app/api/articles/[id]/skip/route.ts              # Skip article + auto regen subject
src/app/api/campaigns/[id]/articles/reorder/route.ts # Reorder + auto regen subject
src/app/api/articles/manual/route.ts                 # Manual article addition

# Subject Lines
src/app/api/campaigns/[id]/generate-subject/route.ts # Generate subject line
src/app/api/campaigns/[id]/subject-line/route.ts     # Manual subject line update
src/lib/subject-line-generator.ts                    # Shared subject line logic

# Settings & Configuration
src/app/api/settings/ai-prompts/route.ts             # AI prompt management
src/app/api/settings/email/route.ts                  # Email settings
src/app/api/settings/criteria/route.ts               # Scoring criteria config
```

### Core Libraries
```
src/lib/rss-processor.ts                             # RSS processing engine
src/lib/openai.ts                                    # OpenAI integration & prompts
src/lib/mailerlite.ts                                # MailerLite email service
src/lib/supabase.ts                                  # Supabase database client
src/lib/github-storage.ts                            # GitHub image storage
src/lib/article-extractor.ts                         # Full article text extraction
src/lib/slack.ts                                     # Slack notifications
```

### Frontend Dashboard
```
src/app/dashboard/[slug]/page.tsx                    # Newsletter dashboard home
src/app/dashboard/[slug]/campaigns/page.tsx          # Campaign list
src/app/dashboard/[slug]/campaigns/[id]/page.tsx     # Campaign detail & editing
src/app/dashboard/[slug]/settings/page.tsx           # Settings & configuration
```

## 🔄 Content Management Protocol

**CLAUDE.MD AS PRIMARY REPOSITORY:**
- This file (CLAUDE.md) is now the main content repository for all development notes
- All session activities should be documented here in real-time

**AUTOMATIC UPDATE PROTOCOL:**
- **BEFORE CONDENSING**: Always add current session notes to appropriate section
- **After Adding**: Update the "Last Updated" timestamp
- **Then Proceed**: With condensing operations while preserving all historical context

**Document Maintenance:**
1. Add new issues/resolutions as they arise directly to this file
2. Update timestamps for each session
3. Use debug endpoints to verify current state
4. Commit changes for future reference
5. **CRITICAL**: Keep project overview and MCP connections current

## 🚀 Future Expansion Plans

### Additional Newsletters
- Platform architecture supports multiple newsletters
- Each newsletter gets unique slug and optional custom domain
- Shared admin dashboard for all newsletters
- Per-newsletter RSS feeds, AI prompts, and email settings

### Newsletter Isolation
- Database queries filtered by newsletter slug
- Settings scoped to newsletter context
- User permissions per newsletter
- Analytics tracking per newsletter

---
*This document serves as the authoritative record of development decisions and current system state for the AI Pros Newsletter platform.*
