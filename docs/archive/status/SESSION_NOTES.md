# St. Cloud Scoop Development Session Notes

**Last Updated:** 2025-09-19 20:05 UTC
**Session Focus:** Events Management System & AI-Generated Event Summaries

## 🔍 Current Issues Identified & Resolved

### AI Subject Line Generation Problem
- **Issue**: AI generating "Boost Community with $5K Donation" when user doesn't see $5K donation posts
- **Root Cause**: Multiple articles tied at score 21, but wrong article was being used for subject line generation
- **Campaign ID**: `0f46cbf6-ab82-4aba-ab0c-c983d659a0c2`

### Article Ranking Analysis
```
Current Campaign Articles (All Score 21):
1. "Absentee Voting Opens for Key Stearns County Elections" ← Should be used
2. "Celebrate 45 Years of Music at Red Carpet Nightclub"
3. "Celebrate Local Heroes at Central Minnesota's Safety Awards"
4. "Veterans Support Brigade Boosts Community" ← Was generating subject line
5. "Lost Border Collie Awaits Reunion" (Score: 19)
```

## ✅ Fixes Implemented

### 1. Subject Line Generation Logic (`generate-subject/route.ts`)
- **Changed**: Now uses only the highest scored article (first in sorted array)
- **Added**: Comprehensive logging to track which article is being used
- **Enhanced**: Timestamp-based prompt variation for uniqueness

### 2. OpenAI Configuration (`openai.ts`)
- **Temperature**: Increased from 0.3 to 0.8 for more creative variation
- **Creativity Rules**: Added explicit requirements for unique headline variations
- **Function**: Made temperature configurable with `callOpenAI(prompt, maxTokens, temperature)`

### 3. Send for Review Integration (`send-review/route.ts`)
- **Added**: Support for forced subject line parameter from frontend
- **Enhanced**: Detailed logging throughout the flow
- **Fixed**: MailerLite service now accepts and prioritizes forced subject line

### 4. MailerLite Service (`mailerlite.ts`)
- **Updated**: `createReviewCampaign()` method accepts optional `forcedSubjectLine` parameter
- **Prioritizes**: Forced subject line > campaign subject line > fallback

## 🛠️ Debug Tools Created

### API Endpoints
- `/api/debug/recent-campaigns` - Lists recent campaigns with details
- `/api/debug/campaign-articles?campaign_id=X` - Shows all articles for specific campaign

### Key Debug URLs
- **Production**: `https://st-cloud-scoop.vercel.app/api/debug/recent-campaigns`
- **Campaign Details**: `https://st-cloud-scoop.vercel.app/api/debug/campaign-articles?campaign_id=0f46cbf6-ab82-4aba-ab0c-c983d659a0c2`

## 🔧 Technical Configuration

### Email Settings (Confirmed Working)
- **Sender Name**: "St. Cloud Scoop"
- **From Email**: "scoop@stcscoop.com"
- **Subject Format**: "🍦 [Subject Line]"
- **Domain**: Authenticated and verified

### AI Prompt Requirements
- **Character Limit**: ≤35 characters (allows room for emoji prefix)
- **Style**: Front-page newspaper headline, breaking news voice
- **Restrictions**: No colons, em dashes, year references, or "today/tomorrow"
- **Creativity**: Each generation should produce unique variations

### Content Filtering Rules
- **Excluded**: Lost pet posts (implemented in AI prompts)
- **Email Format**: Uses global CSS rules from `gloabalemailrules.txt`
- **Article Order**: Sorted by AI score (highest first)

## 📊 Current Status

### What's Working
- ✅ AI subject line generation infrastructure
- ✅ Debug endpoints for troubleshooting
- ✅ Send for Review with forced subject line passing
- ✅ Email template consistency with preview

### Testing Required
- 🔄 Generate new subject line to verify top article usage
- 🔄 Confirm subject line variations on regeneration
- 🔄 Verify Vercel function logs show detailed debugging info

## 🤖 Automated Newsletter Scheduling System

### Schedule Configuration (Central Time)
- **8:30 PM**: Create Tomorrow's Campaign + RSS Processing (`/api/cron/rss-processing`)
- **8:45 PM**: AI Subject Line Generation - Fixed 15min after RSS (`/api/cron/generate-subject`)
- **8:50 PM**: Create Review Campaign & Schedule for 9pm (`/api/cron/create-campaign`)
- **9:00 PM**: MailerLite sends scheduled review campaign to review group only

### Settings Page Integration
- Added "Email" tab with configurable scheduling times
- MailerLite settings (Review Group ID, From Email, Sender Name)
- API Key field removed from UI for security
- All times configurable via web interface
- Settings stored in `app_settings` table

### Automation Features
- **Smart Status Checking**: Only processes campaigns in appropriate status
- **Error Handling**: Comprehensive logging and status updates
- **Idempotent**: Safe to run multiple times, won't duplicate work
- **Manual Testing**: GET endpoints with secret parameter for debugging

## 🆕 Recent Updates (Sept 19, 2025 - Session 2)

### Events Management System Overhaul
- **Comprehensive Events Sync**: Fixed pagination to get all events (62 vs 50 previously)
- **HTML Entity Decoding**: Converted encoded characters like `&#8217;` to proper apostrophes
- **CRUD Operations**: Added full edit/delete functionality for events database page
- **Timezone Consistency**: Fixed Central Time (-5 UTC) alignment between dashboard and HTML generation
- **Newsletter Template**: Updated to 3-column design with emoji categorization matching provided template

### AI-Generated Event Summaries Implementation
- **Database Schema**: Added `event_summary` TEXT column to events table
- **AI Integration**: Implemented `eventSummarizer` prompt with 50-word natural language requirement
- **Automatic Generation**: AI summaries generated during sync for events without existing summaries
- **Newsletter Enhancement**: Featured events now use AI summaries for better descriptions
- **Bulk Processing**: Created dedicated endpoint for retroactive AI summary generation

### Events Sync Improvements
- **Daily Strategy**: Changed from 7-day ranges to individual day calls for better results
- **Error Handling**: Improved resilience with individual day failure tolerance
- **Smart Updates**: Preserves existing AI summaries to avoid unnecessary API calls
- **Comprehensive Logging**: Detailed console output for monitoring and debugging

### Database Management Enhancements
- **Inline Editing**: Real-time field editing with save/cancel functionality
- **Delete Operations**: Secure event removal with confirmation
- **API Endpoints**: RESTful PATCH/DELETE operations for events
- **TypeScript Fixes**: Updated parameter patterns for Next.js 15 App Router

### Technical Achievements
- **HTML Generation**: Synchronized events dates between dashboard and newsletter HTML
- **Image Removal**: Cleaned up Local Events section by removing unused images
- **Build Pipeline**: Fixed TypeScript compilation errors for deployment
- **Performance**: Efficient batch processing with rate limiting for AI operations

## 🚧 Database Schema Update Required

### Missing Column Fix
- **Issue**: `event_summary` column needs to be added to Supabase events table
- **SQL Command**: `ALTER TABLE events ADD COLUMN event_summary TEXT;`
- **Impact**: Required for AI summary functionality and bulk processing endpoint
- **Status**: ⚠️ Pending manual execution in Supabase SQL Editor

## 🆕 Previous Updates (Sept 19, 2025 - Session 1)

### Campaign Approval System
- **Added**: "Changes Made" and "Approved" buttons to campaign detail page
- **Status Workflow**: Draft → In Review → Ready to Send → Sent
- **Database**: Added `last_action`, `last_action_at`, `last_action_by` fields
- **Slack Integration**: Sends notifications when "Changes Made" is clicked
- **UI Updates**: "Ready to Send" status displays throughout dashboard

### Slack Notification Improvements
- **Simple Messages**: Clean format using `sendSimpleMessage()` method
- **Date Format**: Uses full formatted date "Wednesday, September 17, 2025"
- **Removed Fields**: Eliminated INFO/TIME/CONTEXT metadata for cleaner messages
- **Webhook**: Configured `SLACK_WEBHOOK_URL` in Vercel environment

### Article Image Thumbnails
- **Visual Selection**: Added 64x64px thumbnail images next to article titles
- **Source**: Images from RSS post `image_url` field when available
- **Error Handling**: Images gracefully hide on load failure
- **Layout**: Responsive design with proper spacing and alignment

### Technical Fixes
- **TypeScript Errors**: Fixed compilation issues with Next.js 15 route params
- **Build Process**: Local build verification before deployments
- **Database Migration**: Applied approval system schema changes

## 🚀 Next Steps

1. **Database Schema**: Add `event_summary` column to Supabase events table
2. **Test AI Summaries**: Run bulk generation endpoint after schema update
3. **Verify Newsletter**: Test featured events display AI summaries correctly
4. **Monitor Sync**: Ensure new events automatically get AI summaries during daily sync

## 📁 Key Files Modified

```
# AI Subject Line Fixes
src/app/api/campaigns/[id]/generate-subject/route.ts  # Core logic fix
src/app/api/campaigns/[id]/send-review/route.ts       # Forced subject line
src/lib/mailerlite.ts                                 # Service updates + createFinalCampaign
src/lib/openai.ts                                     # Temperature & prompts

# Debug Tools
src/app/api/debug/recent-campaigns/route.ts          # Debug endpoint
src/app/api/debug/campaign-articles/route.ts         # Debug endpoint

# Automated Scheduling System
src/app/dashboard/settings/page.tsx                  # Email settings UI
src/app/api/settings/email/route.ts                  # Settings API
src/app/api/cron/rss-processing/route.ts             # RSS automation
src/app/api/cron/generate-subject/route.ts           # Subject automation
src/app/api/cron/create-campaign/route.ts            # Campaign automation (review only)
vercel.json                                           # Cron schedule config (main group sending removed)

# Session 1 Updates (Sept 19, 2025)
src/app/api/campaigns/[id]/status/route.ts           # Campaign approval API
src/app/dashboard/campaigns/[id]/page.tsx            # Approval buttons + image thumbnails
src/app/dashboard/campaigns/page.tsx                 # "Ready to Send" status display
src/lib/slack.ts                                     # Simple message method
src/app/api/test/database/route.ts                   # TypeScript compilation fix
src/types/database.ts                                # Status workflow types
database_migration_approval_system.sql               # Database schema update

# Session 2 Updates (Sept 19, 2025) - Events Management & AI Summaries
src/app/api/events/sync/route.ts                     # Enhanced sync with AI summaries
src/app/api/events/manual-sync/route.ts              # Manual sync with AI summaries
src/app/api/events/[id]/route.ts                     # PATCH/DELETE operations for events
src/app/api/events/generate-summaries/route.ts       # Bulk AI summary generation
src/app/dashboard/databases/events/page.tsx          # Inline editing and delete functionality
src/app/dashboard/campaigns/[id]/page.tsx            # Timezone fixes and image removal
src/app/api/campaigns/[id]/preview/route.ts          # HTML template updates and AI summary integration
src/lib/openai.ts                                    # Added eventSummarizer prompt
src/types/database.ts                                # Added event_summary field to Event interface
```

## 🔄 Auto-Update Instructions

**To update this document:**
1. Add new issues/resolutions as they arise
2. Update the "Last Updated" timestamp
3. Commit changes for future reference
4. Use debug endpoints to verify current state

---
*This document serves as the authoritative record of development decisions and current system state.*