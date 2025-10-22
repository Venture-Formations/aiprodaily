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
- **Vercel AI SDK** (Potential Integration):
  - Streaming text generation
  - Chat interfaces with useChat hook
  - Tool calling and function execution
  - Server actions for LLM integration
- **MailerLite**:
  - Email campaign delivery
  - Subscriber management
  - Review group campaigns
  - Final campaign scheduling and sending

### Reference Documentation
When implementing AI features or working with Vercel platform:
- **Vercel AI SDK**: `docs/vercel-ai-sdk.md` - AI SDK patterns, hooks, streaming, and tool calling
- **Vercel API**: `docs/vercel-api.md` - Platform API reference for deployments and functions
- **Project Guide**: `CLAUDE.md` - This file, comprehensive project documentation

## 🔐 Required Environment Variables

### Core Services
```bash
DATABASE_URL=                    # Supabase PostgreSQL connection string
SUPABASE_SERVICE_ROLE_KEY=       # Supabase admin access key (bypasses RLS)
OPENAI_API_KEY=                  # ChatGPT API access for content generation
MAILERLITE_API_KEY=              # Email service API for campaigns
```

### Authentication & Security
```bash
NEXTAUTH_SECRET=                 # NextAuth.js session encryption key
NEXTAUTH_URL=                    # Application URL for OAuth callbacks
CRON_SECRET=                     # Vercel cron job authentication token
```

### Optional Services
```bash
SLACK_WEBHOOK_URL=               # Slack notifications for RSS processing
GITHUB_TOKEN=                    # GitHub API token for image storage
GITHUB_REPO=                     # Repository name for image storage (e.g., "username/ai-pros-images")
GITHUB_BRANCH=                   # Branch for image storage (default: "main")
```

### Payment Processing (if ads enabled)
```bash
STRIPE_SECRET_KEY=               # Stripe API key for ad payments
STRIPE_WEBHOOK_SECRET=           # Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Stripe public key (client-side)
```

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

### AI Feature Implementation Guidelines

**Before implementing any AI-powered feature, ALWAYS:**

1. **Reference Documentation First**
   - Read the relevant section in `docs/vercel-ai-sdk.md`
   - Review existing AI implementations in `src/lib/openai.ts`
   - Check for similar patterns in the codebase

2. **Follow Established Patterns**
   - Use the exact patterns shown in documentation
   - Import from recommended packages
   - Match existing project configurations

3. **Current AI Implementation**
   - Project uses direct OpenAI API calls via `src/lib/openai.ts`
   - Custom `callOpenAI()` wrapper for API interactions
   - JSON response parsing with fallback handling
   - Multi-criteria evaluation system for content scoring

4. **Potential Migration to Vercel AI SDK**
   - If migrating features to Vercel AI SDK, consult `docs/vercel-ai-sdk.md`
   - Maintain backward compatibility with existing AI prompts
   - Test thoroughly before replacing working implementations

### Common AI Development Tasks

#### Chat Interface (If Needed)
**Reference**: "useChat hook" in `docs/vercel-ai-sdk.md`
```typescript
import { useChat } from 'ai/react'

const { messages, input, handleSubmit } = useChat({
  api: '/api/chat'
})
```

#### Streaming Text Generation
**Reference**: "streamText" in `docs/vercel-ai-sdk.md`
```typescript
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const result = await streamText({
  model: openai('gpt-4-turbo'),
  prompt: 'Your prompt here',
})
```

#### Current Implementation (Non-Streaming)
**Location**: `src/lib/openai.ts`
```typescript
import { callOpenAI } from '@/lib/openai'

// Current pattern used throughout project
const result = await callOpenAI(prompt, {
  temperature: 0.7,
  max_tokens: 1000
})
```

#### Tool Calling (Advanced)
**Reference**: "tools" section in `docs/vercel-ai-sdk.md`
- Use for complex AI interactions requiring function execution
- Define tools with zod schemas
- Handle tool results in streaming responses

### AI Best Practices for This Project

1. **Prompt Engineering**
   - Store prompts in database (`app_settings` table)
   - Allow customization via Settings UI
   - Test prompts before deploying
   - Use consistent formatting across all prompts

2. **Error Handling**
   - Wrap AI calls in try-catch blocks
   - Implement retry logic for transient failures
   - Log errors with context (campaign_id, prompt type)
   - Provide fallback behavior when AI fails

3. **Performance**
   - Batch AI operations with delays (prevent rate limits)
   - Cache results when appropriate
   - Monitor token usage
   - Use appropriate model for task (gpt-4-turbo vs gpt-3.5-turbo)

4. **Testing**
   - Use `/api/debug/test-ai-prompts` for prompt testing
   - Test with realistic newsletter data
   - Verify output format matches expectations
   - Check edge cases (empty content, very long content)

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

## ⚡ Performance Optimization

### Vercel Function Limits
- **Timeout**: 600 seconds (10 minutes) for RSS processing routes
- **Log Size**: 10MB maximum per function execution
- **Memory**: 1024MB default (configurable in vercel.json)
- **Response Size**: 4.5MB maximum response body

### Optimization Strategies Implemented
1. **Minimal Logging**
   - Removed 100+ console.log statements from RSS processor
   - Single-line format for evaluation results
   - Only essential error/status messages logged

2. **Batch Processing**
   - AI scoring in batches of 3 posts (prevents rate limits)
   - 2-second delays between batches
   - Concurrent article extraction (10 at a time)

3. **Direct Function Calls**
   - Combined steps call methods directly (no HTTP overhead)
   - Eliminated intermediate API requests
   - Faster execution (4 steps instead of 7)

4. **Retry Logic**
   - Each step retries once on transient failures
   - Prevents full workflow restart on temporary issues
   - Campaign marked failed only after 2 attempts

5. **Efficient Database Queries**
   - Select only required fields
   - Use indexes for campaign_id, feed_id lookups
   - Batch updates where possible

### Performance Monitoring
```bash
# Check function execution times in Vercel dashboard
# Monitor log sizes to ensure under 10MB limit
# Watch for timeout warnings (>540 seconds)
# Review Supabase query performance
```

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

## 📡 RSS Feed Management

### Feed Structure
- **Primary Section**: Top 5 articles (highest scores)
- **Secondary Section**: 3-5 articles (different feeds/perspectives)
- **Active Feeds**: Toggle on/off in Settings > RSS Feeds
- **Lookback Window**: 24 hours from campaign date
- **Section Assignment**: Each feed assigned to primary, secondary, or both

### Adding New RSS Feeds
1. Navigate to **Settings > RSS Feeds** in dashboard
2. Click "Add New Feed" button
3. Enter feed details:
   - Feed URL (must be valid RSS/Atom feed)
   - Display name
   - Section assignment (primary/secondary)
   - Active status
4. Test fetch before activating
5. Monitor first campaign for quality

### Feed Configuration Options
- **Use for Primary Section**: Include in main article selection
- **Use for Secondary Section**: Include in secondary article selection
- **Active**: Enable/disable without deleting
- **Processing Errors**: Auto-tracked for troubleshooting

### Best Practices
- ✅ Test new feeds with manual campaign first
- ✅ Monitor post quality and scoring
- ✅ Use diverse sources for better coverage
- ✅ Deactivate low-quality feeds instead of deleting
- ✅ Review feed errors regularly

## 🎯 Multi-Criteria Scoring System

### Default Scoring Criteria
The system evaluates each RSS post against customizable criteria:

**Criterion 1: Interest Level** (default weight: 1.5)
- How engaging is this content for the target audience?
- Does it grab attention?
- Is it newsworthy or unique?

**Criterion 2: Professional Relevance** (default weight: 1.5)
- How relevant is this to accounting professionals?
- Does it address industry-specific challenges?
- Is it actionable for readers?

**Criterion 3: Professional Impact** (default weight: 1.0)
- How significant is this development?
- Will it affect readers' work?
- Is it a major trend or minor update?

### How Scoring Works
1. **Evaluation**: Each post evaluated against enabled criteria (default: 3)
2. **Scoring**: AI assigns 0-10 score per criterion
3. **Weighting**: Scores multiplied by criterion weight
4. **Total Score**: Weighted sum calculated (e.g., 25.5 out of max 40)
5. **Ranking**: Posts ranked by total_score descending
6. **Selection**: Top N posts selected for newsletter

### Score Calculation Example
```
Criterion 1: 8/10 × weight 1.5 = 12.0
Criterion 2: 7/10 × weight 1.5 = 10.5
Criterion 3: 5/10 × weight 1.0 =  5.0
                    Total Score = 27.5 (max possible: 40)
```

### Customizing Scoring Criteria

#### Edit Criteria Prompts
1. Navigate to **Settings > AI Prompts**
2. Find criteria evaluator prompts (criteria1Evaluator, criteria2Evaluator, etc.)
3. Click "Edit" to modify prompt
4. Use "Test Prompt" to verify output
5. Save changes or "Save as Default"

#### Adjust Criteria Weights
1. Navigate to **Settings > Scoring Criteria**
2. Modify weights (higher = more important)
3. Common patterns:
   - Equal weights: 1.0, 1.0, 1.0 (all criteria equal)
   - Emphasis on relevance: 1.0, 2.0, 1.0
   - Emphasis on impact: 1.0, 1.0, 2.0
4. Save and apply to future campaigns

#### Enable/Disable Criteria
- **Criteria Enabled Count**: Set to 2 or 3 (up to 3 supported)
- Disabled criteria are skipped during evaluation
- Weights still apply to enabled criteria

### Viewing Scores
- **Campaign Detail Page**: View scores for all articles
- **Article Cards**: Display total_score and ranking
- **Post Ratings Table**: Full breakdown by criterion
- **Debug Endpoint**: `/api/debug/check-posts?campaign_id=X`

## 🎨 Additional Platform Features

### Secondary Articles System
- **Purpose**: Provide diverse perspectives or supplementary content
- **Separate Feeds**: Uses different RSS feeds than primary section
- **Independent Scoring**: Scored separately with same criteria
- **Article Count**: Typically 3-5 articles (configurable)
- **Toggle Active**: Can activate/deactivate individual secondary articles
- **Reordering**: Drag-and-drop ranking like primary articles

### Advertisement Management (If Enabled)
- **Ad Submission**: Public form for ad submissions
- **Review Workflow**: Admin approval before activation
- **Stripe Integration**: Payment processing for ad purchases
- **Position Management**: Automatic or manual ad positioning
- **Ad Pricing**: Configurable pricing tiers
- **Ad Analytics**: Track ad performance and clicks

### Breaking News
- **Manual Entry**: Add time-sensitive content outside RSS flow
- **Priority Display**: Shows above regular articles
- **Skip RSS**: Manually created content with custom text
- **Quick Turnaround**: Bypass normal campaign workflow

### Newsletter Polls
- **Poll Creation**: Create surveys for subscriber engagement
- **Active Status**: One active poll per campaign
- **Response Tracking**: View poll results in real-time
- **Newsletter Integration**: Polls embedded in email campaigns

### Image Management System
- **Image Database**: Reusable library of newsletter images
- **GitHub Storage**: Permanent hosting for all images
- **Facebook Re-hosting**: Automatic conversion of expiring Facebook CDN URLs
- **Upload Interface**: Manual image uploads for reuse
- **Reverse Lookup**: Find which campaigns used specific images

### Archived Newsletters
- **Public Archive**: Past newsletters viewable on website
- **Search Function**: Find newsletters by date or content
- **Analytics Tracking**: Track archive page views
- **Historical Data**: Preserved articles and RSS posts

## 🐛 Common Issues & Solutions

### Issue: Vercel Function Log Overflow
**Symptom**: RSS processing fails with "Function log limit exceeded" error

**Root Cause**: Excessive console.log statements in processing loops

**Solution**:
- ✅ Implemented minimal logging (January 2025)
- Only essential `[RSS]` prefixed messages
- Single-line evaluation results
- Silent error handling for non-critical failures

**Prevention**: Avoid console.log in loops, use summary logging

---

### Issue: Subject Line Not Regenerating
**Symptom**: Subject line becomes outdated after skip/reorder operations

**Root Cause**: Manual regeneration required in older versions

**Solution**:
- ✅ Automatic regeneration implemented
- Triggers when #1 article position changes
- Real-time UI updates without page refresh

**Check**: Verify article skip/reorder triggers regeneration

---

### Issue: Campaign Deletion Fails
**Symptom**: "Failed to delete campaign" error with 500 status

**Root Cause**: Foreign key constraints from child tables

**Solution**:
- Delete child tables first in correct order
- Error tracking shows which tables failed
- Non-blocking design continues despite some failures

**Tables to Delete** (in order):
1. articles, secondary_articles
2. rss_posts (cascades to post_ratings)
3. user_activities
4. archived_articles, archived_rss_posts
5. newsletter_campaigns

---

### Issue: RSS Processing Timeout
**Symptom**: Function execution exceeds 600 second limit

**Root Cause**: Too many feeds or slow article extraction

**Possible Solutions**:
- Reduce number of active feeds
- Increase timeout in vercel.json (max 900s for Pro plan)
- Disable full article text extraction temporarily
- Check for slow/unresponsive feed URLs

---

### Issue: Articles Not Scoring
**Symptom**: Posts fetched but no scores assigned

**Root Cause**: AI API errors or prompt configuration issues

**Troubleshooting Steps**:
1. Check OpenAI API key validity
2. Review Vercel function logs for AI errors
3. Test criteria prompts in Settings > AI Prompts
4. Verify criteria_enabled_count setting
5. Check post_ratings table for error messages

---

### Issue: Facebook Images Broken
**Symptom**: Image URLs showing broken images in newsletter

**Root Cause**: Facebook CDN URLs expire after a few hours

**Solution**:
- ✅ Automatic GitHub re-hosting implemented
- Facebook images detected during RSS processing
- Downloaded and uploaded to permanent GitHub storage
- Database updated with new GitHub URL

**Prevention**: System now handles automatically

---

### Issue: Date/Time Mismatches
**Symptom**: Campaigns showing wrong date or articles from wrong day

**Root Cause**: UTC timezone conversion errors

**Solution**:
- Never use `.toISOString()` for date comparisons
- Extract date strings directly: `date.split('T')[0]`
- Use local time for all filtering and sorting
- Compare dates as YYYY-MM-DD strings

**Example (Correct)**:
```typescript
const campaignDate = campaign.date.split('T')[0] // "2025-01-22"
```

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

## 🚀 Deployment Checklist

### Pre-Deployment Checks
Before pushing code or deploying to production:

#### 1. Local Build Verification
```bash
npm run build
```
- [ ] Build completes without errors
- [ ] No TypeScript compilation errors
- [ ] No ESLint warnings (if enforced)
- [ ] Check for deprecated dependencies

#### 2. Code Review
- [ ] Review git diff for unexpected changes
- [ ] Check for hardcoded credentials or secrets
- [ ] Verify environment variable references
- [ ] Ensure no debug console.logs in production code
- [ ] Check for commented-out code to remove

#### 3. Database Considerations
- [ ] Verify database migrations if schema changed
- [ ] Check for new required columns
- [ ] Test with production data structure
- [ ] Backup database before major changes

#### 4. Critical Path Testing
- [ ] Test RSS processing flow manually
- [ ] Generate campaign preview
- [ ] Test subject line generation
- [ ] Verify article skip/reorder functionality
- [ ] Check email preview rendering

#### 5. Documentation
- [ ] Update CLAUDE.md if major changes
- [ ] Add comments for complex logic
- [ ] Update API documentation if endpoints changed

### Deployment Process

#### 1. Git Commit
```bash
git add -A
git status  # Review staged changes
git commit -m "Descriptive commit message

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### 2. Push to Repository
```bash
git push
```

#### 3. Monitor Vercel Deployment
- [ ] Check Vercel dashboard for deployment status
- [ ] Review build logs for warnings
- [ ] Verify deployment completes successfully
- [ ] Note deployment URL and timestamp

### Post-Deployment Verification

#### 1. Production Testing
- [ ] Visit production URL (www.aiprodaily.com)
- [ ] Test authentication/login
- [ ] Navigate to campaign dashboard
- [ ] Verify settings pages load
- [ ] Check API endpoints responding

#### 2. Integration Checks
- [ ] Verify Supabase connection working
- [ ] Test MailerLite integration
- [ ] Check OpenAI API calls functioning
- [ ] Verify GitHub image storage working
- [ ] Test Slack notifications (if configured)

#### 3. Cron Job Verification
- [ ] Check vercel.json cron schedules
- [ ] Verify cron jobs appear in Vercel dashboard
- [ ] Test manual cron trigger (if needed)
- [ ] Monitor first automated run

#### 4. Error Monitoring
- [ ] Review Vercel function logs
- [ ] Check for new error patterns
- [ ] Monitor Supabase logs
- [ ] Review Slack notifications for failures

### Rollback Procedure
If deployment causes issues:

```bash
# Find previous working commit
git log --oneline -10

# Revert to previous commit
git revert <commit-hash>
git push

# OR force rollback (use with caution)
git reset --hard <previous-commit-hash>
git push --force
```

### Emergency Contacts
- **Vercel Support**: Via dashboard or support@vercel.com
- **Supabase Support**: Via dashboard support chat
- **OpenAI Status**: status.openai.com

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
