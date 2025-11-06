# St. Cloud Scoop References - Complete Inventory

This document lists all references to St. Cloud Scoop, Road Work, Wordle, and Local Events found throughout the codebase.

---

## 1. ST. CLOUD SCOOP / STC SCOOP REFERENCES

### Code Files

#### `src/lib/newsletter-templates.ts`
- **Line 167**: Default header image URL fallback
  - **Content**: `'https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png'`
  - **Purpose**: Fallback logo when newsletter doesn't have custom header image
  - **Type**: Hardcoded fallback value

- **Line 169**: Default newsletter name fallback
  - **Content**: `'St. Cloud Scoop'`
  - **Purpose**: Fallback name when newsletter settings don't have newsletter_name
  - **Type**: Hardcoded fallback value

- **Line 1271**: Default newsletter name fallback (duplicate)
  - **Content**: `'St. Cloud Scoop'`
  - **Purpose**: Same as above, appears in another function
  - **Type**: Hardcoded fallback value

#### `src/app/dashboard/[slug]/settings/page.tsx`
- **Line 1130**: Default sender name
  - **Content**: `senderName: 'St. Cloud Scoop'`
  - **Purpose**: Default email sender name in settings form
  - **Type**: Form default value

#### `src/app/api/settings/email/route.ts`
- **Line 48**: Default sender name
  - **Content**: `senderName: 'St. Cloud Scoop'`
  - **Purpose**: Default value when creating email settings
  - **Type**: API default value

#### `src/lib/mailerlite.ts`
- **Line 60**: Default sender name fallback
  - **Content**: `'St. Cloud Scoop'`
  - **Purpose**: Fallback when email_senderName setting is missing
  - **Type**: Hardcoded fallback value

- **Line 61**: Default from email fallback
  - **Content**: `'scoop@stcscoop.com'`
  - **Purpose**: Fallback when email_fromEmail setting is missing
  - **Type**: Hardcoded fallback value

- **Line 560**: Default sender name fallback (duplicate)
  - **Content**: `'St. Cloud Scoop'`
  - **Purpose**: Same as line 60, in different function
  - **Type**: Hardcoded fallback value

- **Line 561**: Default from email fallback (duplicate)
  - **Content**: `'scoop@stcscoop.com'`
  - **Purpose**: Same as line 61, in different function
  - **Type**: Hardcoded fallback value

- **Line 789**: Email approval message
  - **Content**: `'Your event submission has been approved and is now live on St. Cloud Scoop.'`
  - **Purpose**: Event approval email content
  - **Type**: Email template text

- **Line 830**: Email signature
  - **Content**: `'The St. Cloud Scoop Team'`
  - **Purpose**: Email footer signature
  - **Type**: Email template text

- **Line 846**: Email sender name
  - **Content**: `name: 'St. Cloud Scoop'`
  - **Purpose**: Email sender display name
  - **Type**: Email configuration

- **Line 890**: Email rejection message
  - **Content**: `'Thank you for submitting your event to St. Cloud Scoop. After reviewing...'`
  - **Purpose**: Event rejection email content
  - **Type**: Email template text

- **Line 906**: Email signature
  - **Content**: `'The St. Cloud Scoop Team'`
  - **Purpose**: Email footer signature (rejection email)
  - **Type**: Email template text

- **Line 922**: Email sender name
  - **Content**: `name: 'St. Cloud Scoop'`
  - **Purpose**: Email sender display name (rejection email)
  - **Type**: Email configuration

#### `src/lib/gmail-service.ts`
- **Line 19**: Default from name
  - **Content**: `process.env.GMAIL_FROM_NAME || 'St. Cloud Scoop'`
  - **Purpose**: Gmail service sender name fallback
  - **Type**: Environment variable fallback

- **Line 74**: Email approval message
  - **Content**: `'Your event submission has been approved and is now live on St. Cloud Scoop.'`
  - **Purpose**: Event approval email content
  - **Type**: Email template text

- **Line 115**: Email signature
  - **Content**: `'The St. Cloud Scoop Team'`
  - **Purpose**: Email footer signature
  - **Type**: Email template text

- **Line 118**: Email footer link
  - **Content**: `'St. Cloud Scoop | <a href="https://stcscoop.com">stcscoop.com</a>'`
  - **Purpose**: Email footer with website link
  - **Type**: Email template HTML

- **Line 172**: Email rejection message
  - **Content**: `'Thank you for submitting your event to St. Cloud Scoop...'`
  - **Purpose**: Event rejection email content
  - **Type**: Email template text

- **Line 188**: Email signature
  - **Content**: `'The St. Cloud Scoop Team'`
  - **Purpose**: Email footer signature
  - **Type**: Email template text

- **Line 191**: Email footer link
  - **Content**: `'St. Cloud Scoop | <a href="https://stcscoop.com">stcscoop.com</a>'`
  - **Purpose**: Email footer with website link
  - **Type**: Email template HTML

#### `src/app/feedback/thank-you/page.tsx`
- **Line 40**: Thank you message
  - **Content**: `'help us improve the St. Cloud Scoop newsletter.'`
  - **Purpose**: Feedback thank you page text
  - **Type**: UI text

- **Line 50**: Link text
  - **Content**: `'Visit St. Cloud Scoop'`
  - **Purpose**: Link to newsletter website
  - **Type**: UI text

- **Line 55**: Footer text
  - **Content**: `'St. Cloud Scoop • Your Local News Source'`
  - **Purpose**: Footer branding
  - **Type**: UI text

#### `src/app/feedback/error/page.tsx`
- **Line 56**: Link text
  - **Content**: `'Visit St. Cloud Scoop'`
  - **Purpose**: Link to newsletter website
  - **Type**: UI text

- **Line 61**: Footer text
  - **Content**: `'St. Cloud Scoop • Your Local News Source'`
  - **Purpose**: Footer branding
  - **Type**: UI text

#### `src/app/events/view/page.tsx`
- **Line 293**: Image alt text
  - **Content**: `alt="St. Cloud Scoop"`
  - **Purpose**: Logo image alt attribute
  - **Type**: Image metadata

- **Line 292**: Logo image URL
  - **Content**: `'https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png'`
  - **Purpose**: Events page logo
  - **Type**: Image URL

#### `src/app/events/submit/page.tsx`
- **Line 407**: Image alt text
  - **Content**: `alt="St. Cloud Scoop"`
  - **Purpose**: Logo image alt attribute
  - **Type**: Image metadata

- **Line 406**: Logo image URL
  - **Content**: `'https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png'`
  - **Purpose**: Event submit page logo
  - **Type**: Image URL

#### `src/app/events/[id]/page.tsx`
- **Line 235**: Image alt text
  - **Content**: `alt="St. Cloud Scoop"`
  - **Purpose**: Logo image alt attribute
  - **Type**: Image metadata

#### `src/app/dashboard/polls/page.tsx`
- **Line 258**: Placeholder text
  - **Content**: `'How satisfied are you with the St. Cloud Scoop newsletter?'`
  - **Purpose**: Poll question placeholder example
  - **Type**: Form placeholder

#### `src/app/api/test/slack/route.ts`
- **Line 18**: Test notification text
  - **Content**: `'Test notification from St. Cloud Scoop approval system'`
  - **Purpose**: Slack test notification message
  - **Type**: Test message

#### `src/app/api/debug/test-mailerlite-schedule/route.ts`
- **Line 59**: Test email from name
  - **Content**: `from_name: 'St. Cloud Scoop'`
  - **Purpose**: Test email configuration
  - **Type**: Test data

#### `src/app/api/debug/test-mailerlite-schedule-format/route.ts`
- **Line 40**: Test email from name
  - **Content**: `from_name: 'St. Cloud Scoop'`
  - **Purpose**: Test email configuration
  - **Type**: Test data

#### `src/app/api/debug/mailerlite-test/route.ts`
- **Line 129**: Test email from name
  - **Content**: `from_name: 'St. Cloud Scoop'`
  - **Purpose**: Test email configuration
  - **Type**: Test data

#### `src/app/api/debug/setup-stripe-webhook/route.ts`
- **Line 32**: Webhook description
  - **Content**: `'St. Cloud Scoop - Event Checkout Webhook (Test Mode)'`
  - **Purpose**: Stripe webhook setup description
  - **Type**: Configuration text

#### `src/app/api/ads/checkout/route.ts`
- **Line 46**: Checkout description
  - **Content**: `'appearance(s) in St. Cloud Scoop Newsletter'`
  - **Purpose**: Stripe checkout description
  - **Type**: Payment description

#### `src/app/ads/submit/page.tsx`
- **Line 144**: Ad submission description
  - **Content**: `'Get featured in the St. Cloud Scoop newsletter's Community Business Spotlight section.'`
  - **Purpose**: Ad submission page description
  - **Type**: UI text

#### `src/lib/newsletter-templates.ts`
- **Line 620**: Events URL
  - **Content**: `'https://events.stcscoop.com/events/view'`
  - **Purpose**: Link to view all events in newsletter
  - **Type**: Hardcoded URL

- **Line 621**: Submit event URL
  - **Content**: `'https://events.stcscoop.com/events/submit'`
  - **Purpose**: Link to submit events in newsletter
  - **Type**: Hardcoded URL

#### `src/lib/github-storage.ts`
- **Line 49**: User-Agent header
  - **Content**: `'StCloudScoop-Newsletter/1.0'`
  - **Purpose**: GitHub API user agent
  - **Type**: HTTP header

- **Line 142**: User-Agent header (duplicate)
  - **Content**: `'StCloudScoop-Newsletter/1.0'`
  - **Purpose**: GitHub API user agent
  - **Type**: HTTP header

#### `src/lib/vrbo-image-processor.ts`
- **Line 35**: User-Agent header
  - **Content**: `'StCloudScoop-Newsletter/1.0'`
  - **Purpose**: HTTP request user agent
  - **Type**: HTTP header

#### `src/lib/road-work-scraper.ts`
- **Line 16**: Function name
  - **Content**: `scrapeStCloudRoadWork()`
  - **Purpose**: Function to scrape St. Cloud city road work
  - **Type**: Function name

- **Line 22**: Road work URL
  - **Content**: `'https://www.ci.stcloud.mn.us/307/Road-Construction-Projects'`
  - **Purpose**: St. Cloud city road work page URL
  - **Type**: Hardcoded URL

- **Line 88**: Road work URL in prompt
  - **Content**: `'https://www.ci.stcloud.mn.us/307/Road-Construction-Projects'`
  - **Purpose**: Included in AI prompt for road work scraping
  - **Type**: Prompt reference

#### `src/lib/perplexity.ts`
- **Line 135**: Road work prompt includes St. Cloud URL
  - **Content**: `'https://www.ci.stcloud.mn.us'`
  - **Purpose**: Included in AI prompt for road work
  - **Type**: Prompt reference

- **Line 253**: St. Cloud URL in context
  - **Content**: `"https://www.ci.stcloud.mn.us"`
  - **Purpose**: Included in Perplexity API context
  - **Type**: API context

#### `src/lib/openai.ts`
- **Line 461**: Road work prompt includes St. Cloud URL
  - **Content**: `'https://www.ci.stcloud.mn.us (St. Cloud)'`
  - **Purpose**: Included in AI prompt for road work generation
  - **Type**: Prompt reference

#### `src/app/api/settings/ai-prompts/route.ts`
- **Line 498**: Road work prompt includes St. Cloud URL
  - **Content**: `'https://www.stcloudmn.gov/directory/departments/public-services'`
  - **Purpose**: Included in default AI prompt for road work
  - **Type**: Prompt reference

#### `src/app/api/debug/test-visitstcloud/route.ts`
- **Line 5**: Function name
  - **Content**: `'Testing VisitStCloud API access...'`
  - **Purpose**: Test endpoint for VisitStCloud API
  - **Type**: Test endpoint

- **Line 21**: User-Agent header
  - **Content**: `'StCloudScoop/1.0'`
  - **Purpose**: HTTP request user agent
  - **Type**: HTTP header

#### `src/app/api/debug/test-fetch/route.ts`
- **Line 19**: Log message
  - **Content**: `'Attempting fetch with StCloudScoop user agent...'`
  - **Purpose**: Debug log message
  - **Type**: Log text

- **Line 23**: User-Agent header
  - **Content**: `'StCloudScoop-Newsletter/1.0'`
  - **Purpose**: HTTP request user agent
  - **Type**: HTTP header

#### `src/app/api/debug/initialize-ai-prompts/route.ts`
- **Line 172**: Road work prompt includes St. Cloud URL
  - **Content**: `'https://www.stcloudmn.gov/directory/departments/public-services'`
  - **Purpose**: Included in default AI prompt for road work
  - **Type**: Prompt reference

### Documentation Files

#### `README.md`
- **Line 1**: Project title
  - **Content**: `'# St. Cloud Scoop Newsletter System'`
  - **Purpose**: Main README title
  - **Type**: Documentation

- **Line 227**: License/proprietary notice
  - **Content**: `'This project is proprietary software for St. Cloud Scoop newsletter operations.'`
  - **Purpose**: Project ownership statement
  - **Type**: Documentation

#### `NEWSLETTER_ARCHIVE_TO_WEBSITE_IMPLEMENTATION_GUIDE.md`
- Multiple references throughout (lines 3, 229, 275, 425, 445, 685, 686, 698, 699, 721, 847, 1003, 1004, 1007, 1030, 1031, 1132, 1195, 1258, 1262, 1295, 1620, 1640)
  - **Purpose**: Implementation guide referencing St. Cloud Scoop as example
  - **Type**: Documentation/guide

#### `docs/AI_PROMPT_SYSTEM_GUIDE.md`
- Multiple references (lines 781, 949, 1121, 1155)
  - **Purpose**: Guide for St. Cloud Scoop project
  - **Type**: Documentation/guide

#### `agent-os/product/mission.md`
- **Line 100**: Reference to St. Cloud Scoop model
  - **Purpose**: Product mission documentation
  - **Type**: Documentation

- **Line 220**: Reference to legacy newsletter
  - **Purpose**: Product documentation
  - **Type**: Documentation

#### `TESTING_CHECKLIST.md`
- **Line 16**: Testing note about branding
  - **Purpose**: Testing documentation
  - **Type**: Documentation

- Multiple other references (lines 125, 142, 156, 198)
  - **Purpose**: Testing notes
  - **Type**: Documentation

#### `SESSION_PROGRESS.md`
- **Line 4**: Session focus note
  - **Purpose**: Session documentation
  - **Type**: Documentation

- **Line 11**: Migration notes
  - **Purpose**: Session documentation
  - **Type**: Documentation

- **Line 163**: Reusable components note
  - **Purpose**: Session documentation
  - **Type**: Documentation

#### `SESSION_NOTES.md`
- **Line 1**: File title
  - **Purpose**: Session notes documentation
  - **Type**: Documentation

- **Line 57**: Configuration notes
  - **Purpose**: Session documentation
  - **Type**: Documentation

#### `DASHBOARD_MIGRATION_STATUS.md`
- Multiple references throughout
  - **Purpose**: Migration documentation
  - **Type**: Documentation

#### `MULTI_TENANT_MIGRATION_GUIDE.md`
- Multiple references throughout (lines 5, 34, 36, 50, 68, 183, 239, 251, 274, 475, 484, 763, 893, 1062, 1083, 1089, 1101, 1116, 1131, 1154, 1225, 1229, 1254, 1257)
  - **Purpose**: Migration guide documentation
  - **Type**: Documentation

#### `AI_PROFESSIONAL_NEWSLETTER_PLAN.md`
- **Line 18**: Comparison table
  - **Purpose**: Planning documentation
  - **Type**: Documentation

- Multiple other references
  - **Purpose**: Planning documentation
  - **Type**: Documentation

#### `CLAUDE.md.backup`
- Multiple references
  - **Purpose**: Backup documentation
  - **Type**: Documentation

#### Various `.backup` files
- Multiple references in backup files
  - **Purpose**: Backup copies of files
  - **Type**: Backup files

---

## 2. ROAD WORK REFERENCES

### Code Files

#### `src/lib/openai.ts`
- **Line 415**: Road work generator function
  - **Purpose**: AI prompt for generating road work items
  - **Type**: AI prompt function

- **Line 470**: Road work generator prompt target
  - **Purpose**: Prompt instructions for road work
  - **Type**: AI prompt text

- **Line 593**: Road work validator function
  - **Purpose**: AI prompt for validating road work items
  - **Type**: AI prompt function

- **Line 607-608**: Road work validator prompt
  - **Purpose**: Prompt instructions for validation
  - **Type**: AI prompt text

- **Line 1141**: Road work generator function (async version)
  - **Purpose**: Async version of road work generator
  - **Type**: AI prompt function

- **Line 1285**: Road work validator function (async version)
  - **Purpose**: Async version of validator
  - **Type**: AI prompt function

- **Line 1666**: Comment about road work generation
  - **Purpose**: Code comment
  - **Type**: Comment

- **Line 1736**: Log message about road work
  - **Purpose**: Debug log
  - **Type**: Log text

- **Line 2438**: Comment about array matching for road work
  - **Purpose**: Code comment
  - **Type**: Comment

#### `src/app/api/settings/ai-prompts/route.ts`
- **Line 484**: Road work generator prompt
  - **Purpose**: Default AI prompt for road work generation
  - **Type**: Default prompt text

- **Line 496**: Road work prompt includes MN DOT URL
  - **Purpose**: Source URL in prompt
  - **Type**: Prompt reference

- **Line 509**: Road work JSON example
  - **Purpose**: Example JSON structure in prompt
  - **Type**: Prompt example

#### `src/app/api/campaigns/[id]/delete/route.ts`
- **Lines 78-108**: Road work deletion logic
  - **Purpose**: Delete road work data when deleting campaign
  - **Type**: Database cleanup code

#### `src/lib/newsletter-templates.ts`
- **Line 1242**: Comment section header
  - **Purpose**: Code organization comment
  - **Type**: Comment

- **Line 1245**: Road work section generator function
  - **Content**: `generateRoadWorkSection()` - Currently disabled/returns empty
  - **Purpose**: Generate HTML for road work section (disabled for AI Accounting Daily)
  - **Type**: Function (currently disabled)

- **Line 1246**: Log message
  - **Content**: `'Road Work section disabled for AI Accounting Daily'`
  - **Purpose**: Log when road work section is called
  - **Type**: Log text

#### `src/app/api/debug/test-ai-prompts/route.ts`
- **Line 233**: Road work generator in test
  - **Purpose**: Test endpoint includes road work generator
  - **Type**: Test code

- **Lines 539-543**: Road work generator test note
  - **Purpose**: Test endpoint notes about road work
  - **Type**: Test documentation

#### `src/app/dashboard/[slug]/settings/page.tsx`
- **Line 2396**: Road work prompt mapping
  - **Content**: `'ai_prompt_road_work': 'roadWorkGenerator'`
  - **Purpose**: Maps setting key to prompt type
  - **Type**: Configuration mapping

#### `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`
- **Line 443**: RoadWorkSection component
  - **Purpose**: React component for managing road work in campaign
  - **Type**: React component

- **Lines 450-476**: Road work data fetching logic
  - **Purpose**: Fetch and display road work items for campaign
  - **Type**: Component logic

- **Line 487**: Road work selection limit message
  - **Purpose**: UI validation message
  - **Type**: UI text

- **Line 523**: Loading message
  - **Content**: `'Loading road work data...'`
  - **Purpose**: UI loading state
  - **Type**: UI text

- **Line 533**: Section title
  - **Content**: `'Road Work for {campaign.date}'`
  - **Purpose**: Section header
  - **Type**: UI text

- **Line 542**: Empty state message
  - **Content**: `'No road work items found for this date'`
  - **Purpose**: UI empty state
  - **Type**: UI text

- **Line 1088**: Case statement for Road Work section
  - **Purpose**: Render RoadWorkSection component
  - **Type**: Component routing

#### `src/app/website/newsletter/[date]/page.tsx`
- **Line 82**: Road work variable
  - **Purpose**: Extract road work from newsletter sections
  - **Type**: Data extraction

- **Lines 286-292**: Road work section rendering
  - **Purpose**: Display road work in archived newsletter
  - **Type**: UI rendering

#### `src/types/database.ts`
- **Line 533**: RoadWorkItem interface
  - **Purpose**: TypeScript type definition
  - **Type**: Type definition

- **Line 551**: RoadWorkData interface
  - **Purpose**: TypeScript type definition
  - **Type**: Type definition

#### `src/lib/newsletter-archiver.ts`
- **Lines 101-112**: Road work archiving logic
  - **Purpose**: Archive road work data when archiving campaign
  - **Type**: Archive functionality

- **Line 176**: Road work flag
  - **Purpose**: Track if newsletter has road work section
  - **Type**: Archive metadata

#### `src/lib/mailerlite.ts`
- **Line 10**: Import statement
  - **Purpose**: Import generateRoadWorkSection function
  - **Type**: Import

- **Line 412**: Section name check
  - **Purpose**: Check if section is Road Work
  - **Type**: Conditional logic

- **Lines 413-415**: Road work HTML generation
  - **Purpose**: Generate road work HTML for email
  - **Type**: Email generation

#### `src/app/api/campaigns/[id]/preview/route.ts`
- **Line 13**: Import statement
  - **Purpose**: Import generateRoadWorkSection function
  - **Type**: Import

- **Line 238**: Section name check
  - **Purpose**: Check if section is Road Work
  - **Type**: Conditional logic

- **Lines 239-241**: Road work HTML generation
  - **Purpose**: Generate road work HTML for preview
  - **Type**: Preview generation

#### `src/lib/road-work-scraper.ts`
- **Entire file**: Road work scraping utility
  - **Purpose**: Scrape road work data from government sources
  - **Type**: Utility module

#### `src/lib/perplexity.ts`
- **Lines 109-350**: Road work Perplexity integration
  - **Purpose**: Get road work using Perplexity AI
  - **Type**: AI integration

#### `src/app/api/test/road-work/route.ts`
- **Entire file**: Road work test endpoint
  - **Purpose**: Test road work generation
  - **Type**: Test endpoint

#### `src/app/api/feedback/track/route.ts`
- **Line 43**: Road Work in feedback tracking
  - **Purpose**: Track clicks on Road Work section
  - **Type**: Analytics tracking

### Documentation Files

#### `NEWSLETTER_ARCHIVE_TO_WEBSITE_IMPLEMENTATION_GUIDE.md`
- **Line 445**: Road work section comment
  - **Purpose**: Implementation guide note
  - **Type**: Documentation

- **Line 893**: Road work section rendering
  - **Purpose**: Implementation example
  - **Type**: Documentation

- **Line 1043**: Road work variable
  - **Purpose**: Implementation example
  - **Type**: Documentation

- **Lines 1174-1179**: Road work section HTML
  - **Purpose**: Implementation example
  - **Type**: Documentation

- **Line 1290**: Road work section documentation
  - **Purpose**: Implementation guide
  - **Type**: Documentation

- **Line 1295**: Comment about keeping road work
  - **Purpose**: Implementation note
  - **Type**: Documentation

- **Line 1620**: Road work customization note
  - **Purpose**: Implementation checklist
  - **Type**: Documentation

#### `FEATURE_WELCOME_SECTION.md`
- **Line 515**: Road work HTML variable
  - **Purpose**: Feature documentation
  - **Type**: Documentation

- **Line 617**: Road work prompt mapping
  - **Purpose**: Feature documentation
  - **Type**: Documentation

---

## 3. WORDLE REFERENCES

### Code Files

#### `vercel.json`
- **Line 44**: Cron job path
  - **Content**: `"/api/cron/collect-wordle"`
  - **Purpose**: Scheduled job to collect Wordle data
  - **Type**: Cron configuration

- **Line 86**: Function timeout configuration
  - **Content**: `"app/api/cron/collect-wordle/route.ts"`
  - **Purpose**: Set timeout for Wordle collection cron
  - **Type**: Function configuration

#### `src/lib/openai.ts`
- **Line 1663**: Error message about Wordle
  - **Purpose**: Error when web-enabled AI calls used (replaced with scraper)
  - **Type**: Error message

- **Line 1773**: Comment about Wordle array matching
  - **Purpose**: Code comment
  - **Type**: Comment

#### `src/lib/newsletter-templates.ts`
- **Line 644**: Comment section header
  - **Purpose**: Code organization comment
  - **Type**: Comment

- **Line 646**: Wordle section generator function
  - **Purpose**: Generate HTML for Wordle section
  - **Type**: Function

- **Line 648**: Log message
  - **Purpose**: Log when generating Wordle section
  - **Type**: Log text

- **Line 653**: Comment about yesterday's date
  - **Purpose**: Code comment explaining logic
  - **Type**: Comment

- **Line 659**: Log message
  - **Purpose**: Log when looking for Wordle data
  - **Type**: Log text

- **Lines 662-672**: Wordle data fetching and processing
  - **Purpose**: Fetch Wordle data from database and format
  - **Type**: Data processing

- **Line 676**: Wordle card HTML generation
  - **Purpose**: Generate HTML card for Wordle word
  - **Type**: HTML generation

- **Line 693**: Section heading
  - **Content**: `"Yesterday's Wordle"`
  - **Purpose**: Section title in newsletter
  - **Type**: HTML text

- **Line 704**: Error handling
  - **Purpose**: Error handler for Wordle generation
  - **Type**: Error handling

#### `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`
- **Line 126**: WordleSection component
  - **Purpose**: React component for displaying Wordle in campaign
  - **Type**: React component

- **Lines 131-148**: Wordle data fetching logic
  - **Purpose**: Fetch Wordle data for campaign
  - **Type**: Component logic

- **Line 156**: Loading message
  - **Content**: `'Loading Wordle data...'`
  - **Purpose**: UI loading state
  - **Type**: UI text

- **Line 164**: Empty state message
  - **Content**: `'No Wordle data available for yesterday'`
  - **Purpose**: UI empty state
  - **Type**: UI text

- **Line 173**: Wordle word display
  - **Purpose**: Display Wordle word
  - **Type**: UI rendering

- **Lines 177-180**: Wordle definition and fact display
  - **Purpose**: Display Wordle information
  - **Type**: UI rendering

- **Line 1066**: Case statement for Wordle section
  - **Content**: `case 'Yesterday\'s Wordle':`
  - **Purpose**: Render WordleSection component
  - **Type**: Component routing

#### `src/types/database.ts`
- **Line 625**: Wordle interface
  - **Purpose**: TypeScript type definition
  - **Type**: Type definition

#### `src/lib/wordle-scraper.ts`
- **Entire file**: Wordle web scraping utility
  - **Purpose**: Scrape Wordle answers from Tom's Guide
  - **Type**: Utility module

#### `src/app/api/test/wordle/route.ts`
- **Entire file**: Wordle test endpoint
  - **Purpose**: Test Wordle section generation
  - **Type**: Test endpoint

#### `src/app/api/test/all-sections/route.ts`
- **Line 28**: Wordle endpoint reference
  - **Purpose**: Reference to Wordle test endpoint
  - **Type**: Test documentation

- **Lines 125-135**: Sample Wordle section
  - **Purpose**: Sample HTML for testing
  - **Type**: Test data

- **Lines 183-185**: Wordle section documentation
  - **Purpose**: Test endpoint documentation
  - **Type**: Test documentation

#### `src/app/api/feedback/track/route.ts`
- **Line 42**: Wordle in feedback tracking
  - **Content**: `'Yesterdays Wordle'`
  - **Purpose**: Track clicks on Wordle section
  - **Type**: Analytics tracking

#### `src/app/api/debug/migrate-newsletter-sections/route.ts`
- **Line 23**: Wordle section in migration
  - **Content**: `{ name: "Yesterday's Wordle", display_order: 40, is_active: true }`
  - **Purpose**: Default section configuration
  - **Type**: Migration data

- **Line 56**: Wordle section order
  - **Content**: `{ name: 'Yesterday\'s Wordle', order: 40 }`
  - **Purpose**: Section ordering
  - **Type**: Migration data

#### `src/app/api/debug/cleanup-duplicate-sections/route.ts`
- **Line 44**: Wordle section name
  - **Content**: `"Yesterday's Wordle": 40`
  - **Purpose**: Section name mapping for cleanup
  - **Type**: Cleanup configuration

#### `scripts/secure-debug-routes.js`
- **Lines 22, 29, 35, 36**: Wordle-related debug routes
  - **Purpose**: Debug route security configuration
  - **Type**: Security configuration

#### `agent-os/product/tech-stack.md`
- **Lines 686-690**: Wordle scraping example
  - **Purpose**: Technical documentation example
  - **Type**: Documentation

### Documentation Files

#### `MULTI_TENANT_MIGRATION_GUIDE.md`
- **Lines 312-314**: Wordle table migration
  - **Purpose**: Database migration guide
  - **Type**: Documentation

- **Lines 413-415**: Wordle table migration (duplicate)
  - **Purpose**: Database migration guide
  - **Type**: Documentation

- **Line 839**: Wordle table reference
  - **Purpose**: Migration checklist
  - **Type**: Documentation

---

## 4. LOCAL EVENTS REFERENCES

### Code Files

#### `src/lib/newsletter-templates.ts`
- **Line 462**: Comment section header
  - **Purpose**: Code organization comment
  - **Type**: Comment

- **Line 464**: Local Events section generator function
  - **Purpose**: Generate HTML for Local Events section
  - **Type**: Function

- **Line 465**: Log message
  - **Purpose**: Log when generating Local Events section
  - **Type**: Log text

- **Line 572**: Event URL wrapping
  - **Purpose**: Wrap event URL with tracking for "Local Events"
  - **Type**: Tracking logic

- **Line 596**: Event URL wrapping (duplicate)
  - **Purpose**: Wrap event URL with tracking for "Local Events"
  - **Type**: Tracking logic

- **Lines 620-621**: Event URLs
  - **Content**: `'https://events.stcscoop.com/events/view'` and `'https://events.stcscoop.com/events/submit'`
  - **Purpose**: Links to view and submit events
  - **Type**: Hardcoded URLs (St. Cloud Scoop specific)

- **Line 630**: Section heading
  - **Content**: `"Local Events"`
  - **Purpose**: Section title in newsletter
  - **Type**: HTML text

#### `src/app/dashboard/[slug]/settings/page.tsx`
- **Line 4394**: Event description
  - **Content**: `'Featured Event: Event appears prominently in the Local Events section'`
  - **Purpose**: Settings page help text
  - **Type**: UI help text

#### `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`
- **Line 1488**: Event selection message
  - **Content**: `'Click "Local Events" to see available events for selection'`
  - **Purpose**: UI instruction text
  - **Type**: UI text

#### `src/types/database.ts`
- **Line 487**: Comment about Local Events types
  - **Purpose**: Code organization comment
  - **Type**: Comment

#### `src/app/events/view/page.tsx`
- **Line 305**: Page heading
  - **Content**: `"Local Events"`
  - **Purpose**: Page title
  - **Type**: UI text

#### `src/app/api/test/local-events/route.ts`
- **Entire file**: Local Events test endpoint
  - **Purpose**: Test Local Events section generation
  - **Type**: Test endpoint

#### `src/app/api/test/all-sections/route.ts`
- **Line 93**: Sample Local Events section
  - **Purpose**: Sample HTML for testing
  - **Type**: Test data

- **Line 97**: Local Events heading
  - **Purpose**: Sample section heading
  - **Type**: Test data

- **Lines 193-185**: Local Events section documentation
  - **Purpose**: Test endpoint documentation
  - **Type**: Test documentation

#### `src/app/api/feedback/track/route.ts`
- **Line 40**: Local Events in feedback tracking
  - **Purpose**: Track clicks on Local Events section
  - **Type**: Analytics tracking

#### `src/app/api/debug/migrate-newsletter-sections/route.ts`
- **Line 54**: Local Events section in migration
  - **Content**: `{ name: 'Local Events', order: 20 }`
  - **Purpose**: Default section configuration
  - **Type**: Migration data

#### `src/app/api/debug/cleanup-duplicate-sections/route.ts`
- **Line 42**: Local Events section name
  - **Content**: `'Local Events': 20`
  - **Purpose**: Section name mapping for cleanup
  - **Type**: Cleanup configuration

### Documentation Files

#### `CLAUDE.md.backup`
- **Line 574**: Local Events section note
  - **Purpose**: Backup documentation
  - **Type**: Documentation

#### `SESSION_NOTES.md`
- **Line 137**: Local Events section note
  - **Purpose**: Session documentation
  - **Type**: Documentation

#### `DASHBOARD_MIGRATION_STATUS.md`
- **Line 17**: Local Events database page removed
  - **Purpose**: Migration documentation
  - **Type**: Documentation

#### `AI_PROFESSIONAL_NEWSLETTER_PLAN.md`
- **Line 579**: Replacement note
  - **Content**: `'Replace Local Events with AI Applications'`
  - **Purpose**: Planning documentation
  - **Type**: Documentation

#### `src/app/website/newsletter/[date]/page.tsx.backup`
- **Line 126**: Local Events heading
  - **Purpose**: Backup file
  - **Type**: Backup file

#### `FEATURE_NEWSLETTER_ARCHIVE.md`
- **Line 78**: Local Events section note
  - **Purpose**: Feature documentation
  - **Type**: Documentation

---

## SUMMARY BY CATEGORY

### St. Cloud Scoop References
- **Total Instances**: ~109 matches
- **Primary Locations**:
  - Default values/fallbacks in email and newsletter templates
  - Hardcoded URLs (stcscoop.com, events.stcscoop.com)
  - User-Agent headers
  - Logo image URLs
  - Email templates and signatures
  - Documentation files
  - Test endpoints
  - Event-related functionality

### Road Work References
- **Total Instances**: ~226 matches
- **Primary Locations**:
  - AI prompt generation functions
  - Newsletter section rendering
  - Database schemas and types
  - Road work scraping utilities
  - Campaign management UI
  - Archive functionality
  - Test endpoints
  - Documentation

### Wordle References
- **Total Instances**: ~120 matches
- **Primary Locations**:
  - Cron job configuration
  - Newsletter section rendering
  - Wordle scraping utility
  - Database types
  - Campaign management UI
  - Test endpoints
  - Documentation

### Local Events References
- **Total Instances**: ~36 matches
- **Primary Locations**:
  - Newsletter section rendering
  - Event URLs (stcscoop.com specific)
  - Campaign management UI
  - Test endpoints
  - Documentation

---

## NOTES

1. **Road Work**: Currently disabled in `newsletter-templates.ts` (returns empty string for AI Accounting Daily), but all supporting code remains.

2. **Wordle**: Active cron job in `vercel.json` collecting Wordle data daily.

3. **Local Events**: Uses hardcoded St. Cloud Scoop URLs (`events.stcscoop.com`).

4. **St. Cloud Scoop**: Many references are fallback/default values that should be replaced with newsletter-specific settings.

5. **Documentation Files**: Many `.md` files contain references that may be historical/planning documentation.

---

*This inventory was generated on 2025-01-27. Review each instance and decide whether to delete, update, or leave as-is.*


