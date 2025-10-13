# Technology Stack - St. Cloud Scoop

## Overview

St. Cloud Scoop is built on a modern, scalable technology stack that prioritizes automation, AI integration, and developer velocity. Our architecture is designed for a small team to manage a high-volume content pipeline with minimal manual intervention.

---

## Core Framework & Runtime

### Next.js 15.1.3 (App Router)
**Purpose**: Full-stack React framework for web application

**Rationale**:
- **Server-Side Rendering**: Optimal SEO for public pages and email previews
- **API Routes**: Built-in backend API without separate server infrastructure
- **File-Based Routing**: Intuitive URL structure and code organization
- **App Router**: Modern React Server Components for improved performance
- **Vercel Integration**: Seamless deployment and edge functions
- **TypeScript Support**: First-class TypeScript integration out of the box

**Key Features Used**:
- API route handlers (`/api/*`)
- Server-side data fetching
- Middleware for authentication
- Static generation for public pages
- Dynamic routes for campaigns and articles

### TypeScript 5.x
**Purpose**: Type-safe JavaScript development

**Rationale**:
- **Type Safety**: Catch errors at compile time, not runtime
- **Developer Experience**: IntelliSense and autocomplete in VS Code
- **Refactoring Confidence**: Large-scale changes with compile-time verification
- **Documentation**: Types serve as inline documentation
- **Team Coordination**: Shared interfaces prevent integration bugs

**Database Interfaces**:
All database schemas defined in `src/types/database.ts`:
- NewsletterCampaign, Article, RssPost, Event, Advertisement, etc.
- 50+ TypeScript interfaces covering entire data model

### React 18
**Purpose**: User interface library

**Rationale**:
- **Component Model**: Reusable UI components across dashboard
- **Hooks**: State management with useState, useEffect
- **Concurrent Features**: Automatic batching for performance
- **Server Components**: Next.js App Router leverages React 18 features

**Key Components**:
- Campaign management dashboard
- Article reordering with drag-and-drop
- Event selection interface
- Advertisement review system
- Analytics charts and metrics

---

## Database & Data Storage

### Supabase (PostgreSQL)
**Purpose**: Primary database and backend-as-a-service

**Rationale**:
- **Managed PostgreSQL**: No database server management required
- **Real-Time Subscriptions**: Live updates without polling (future feature)
- **Row-Level Security**: Built-in authorization at database level
- **RESTful API**: Automatic API generation from schema
- **Edge Functions**: Serverless functions close to database
- **Storage**: Integrated object storage for images

**Database Schema**:
- 30+ tables covering campaigns, articles, events, advertisements, analytics
- JSONB columns for flexible structured data (road_work_data, email_metrics)
- Foreign key constraints maintain referential integrity
- Indexes on commonly queried fields (campaign_id, date, status)

**Key Tables**:
- `newsletter_campaigns`: Campaign lifecycle management
- `articles` / `rss_posts`: Content pipeline
- `events` / `campaign_events`: Event management
- `advertisements` / `campaign_advertisements`: Ad rotation system
- `email_metrics`: Performance analytics
- `user_activities`: Audit trail
- `app_settings`: Dynamic configuration

**Connection Pattern**:
```typescript
// Admin client bypasses RLS for server-side operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Client-side user authentication
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### GitHub (Image Storage)
**Purpose**: Reliable image hosting with CDN delivery

**Rationale**:
- **Free Hosting**: Unlimited bandwidth for public repositories
- **CDN Delivery**: GitHub automatically serves images via CDN
- **Version Control**: Image history tracked in Git
- **API Access**: Octokit SDK for programmatic uploads
- **Reliability**: GitHub's 99.95% uptime SLA

**Implementation**:
```typescript
// src/lib/github-storage.ts
export async function uploadImageToGitHub(
  imageBuffer: Buffer,
  fileName: string,
  repoPath: string
): Promise<string> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
  const content = imageBuffer.toString('base64')

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: 'stcloudscoop',
    repo: 'images',
    path: `${repoPath}/${fileName}`,
    message: `Add image: ${fileName}`,
    content
  })

  return `https://raw.githubusercontent.com/stcloudscoop/images/main/${repoPath}/${fileName}`
}
```

**Image Processing Pipeline**:
1. RSS feed images downloaded immediately (prevent Facebook CDN expiration)
2. Resized to optimal dimensions (16:9 ratio, 800px width)
3. Uploaded to GitHub repository
4. CDN URL stored in database
5. Email template references GitHub URL

---

## AI & Machine Learning

### OpenAI API (GPT-4o)
**Purpose**: Natural language understanding and generation

**Rationale**:
- **State-of-the-Art**: Best-in-class language model for content evaluation
- **Structured Output**: Reliable JSON responses for programmatic use
- **Web Search**: Responses API with web tools for real-time data (road work)
- **Vision API**: Image analysis and tagging (future feature)
- **Cost Efficiency**: Pay-per-token pricing scales with usage

**AI Operations**:
1. **Content Evaluation** (`contentEvaluator`)
   - Rates articles on interest_level (1-20), local_relevance (1-10), community_impact (1-10)
   - Identifies articles about lost pets, outdated events, breaking news
   - Image penalty scoring (-5 points for missing images)

2. **Newsletter Writing** (`newsletterWriter`)
   - Rewrites articles to 40-75 words
   - Enforces editorial style guide (no "today/tomorrow", no URLs, third-person perspective)
   - Creates engaging headlines without copying original titles

3. **Fact Checking** (`factChecker`)
   - Verifies newsletter content matches source material
   - Detects added information, prohibited words, editorial commentary
   - Scores accuracy (3-30 range, passing threshold: 20)

4. **Deduplication** (`topicDeduper`)
   - Groups similar stories across sources
   - Identifies duplicate event announcements
   - Returns primary article and duplicate indices

5. **Subject Line Generation** (`subjectLineGenerator`)
   - Generates front-page newspaper style headlines
   - 40 character limit (allows for emoji prefix)
   - Creative variations on each generation

6. **Event Summaries** (`eventSummarizer`)
   - Converts verbose event descriptions to 50-word highlights
   - Natural language paraphrasing
   - Captures essence and appeal

7. **Road Work Generation** (`roadWorkGenerator`)
   - Uses Responses API with web search tools
   - Finds current road closures from government sources
   - Validates date ranges and geographic relevance

8. **Image Analysis** (`imageAnalyzer`)
   - Generates captions and alt text
   - Extracts tags (location, scene, objects, mood)
   - OCR text extraction
   - Age group detection

**Prompt Management**:
- AI prompts stored in `app_settings` database table
- Fallback prompts hardcoded in `src/lib/openai.ts`
- Settings UI allows customization without code deployment
- Test endpoint for validating prompt changes

**Cost Management**:
- GPT-4o selected for quality over cost ($5-10 per 1M tokens)
- Token limits prevent runaway costs (1000 tokens for most operations)
- Caching where possible (road work data reused within campaign)

### Google Cloud Vision API
**Purpose**: Image analysis and tagging

**Rationale**:
- **Label Detection**: Automatic image tagging
- **Face Detection**: Count people in images
- **Text Detection**: OCR for signage and venue names
- **Safe Search**: Content moderation
- **Color Detection**: Dominant color analysis

**Use Cases**:
- Automatic image tagging for searchability
- Age-appropriate content filtering
- Venue identification from signage
- Image quality scoring

---

## Email Delivery

### MailerLite API
**Purpose**: Email service provider for newsletter delivery

**Rationale**:
- **High Deliverability**: 99%+ inbox placement rate
- **API-First**: Comprehensive REST API for automation
- **Analytics**: Open rates, click rates, bounce tracking
- **Subscriber Management**: Groups, segments, custom fields
- **Template Editor**: Visual editor for email design
- **Cost**: Free tier for up to 1,000 subscribers

**Implementation**:
```typescript
// src/lib/mailerlite.ts
export async function createFinalCampaign(
  campaignId: string,
  subject: string,
  htmlContent: string
): Promise<string> {
  const response = await fetch('https://api.mailerlite.com/api/v2/campaigns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY!
    },
    body: JSON.stringify({
      type: 'regular',
      subject: `🍦 ${subject}`,
      from: 'scoop@stcscoop.com',
      from_name: 'St. Cloud Scoop',
      groups: [MAIN_GROUP_ID],
      content: htmlContent
    })
  })

  return response.data.id
}
```

**Email Workflow**:
1. **8:30 PM**: RSS processing generates campaign content
2. **9:00 PM**: Review email sent to internal team (via `createReviewCampaign`)
3. **9 PM - 5 AM**: Team reviews and modifies content
4. **4:55 AM**: Final newsletter sent to all subscribers (via `createFinalCampaign`)

**Metrics Tracking**:
- Import metrics daily via `/api/cron/import-metrics`
- Store in `email_metrics` table
- Display in dashboard analytics

---

## Authentication & Authorization

### NextAuth.js
**Purpose**: Authentication library for Next.js

**Rationale**:
- **Zero Config**: Works with Next.js out of the box
- **Multiple Providers**: Supports Google, GitHub, email, etc.
- **Session Management**: JWT or database sessions
- **Security**: CSRF protection, secure cookies
- **TypeScript Support**: Fully typed

**Configuration**:
```typescript
// src/app/api/auth/[...nextauth]/route.ts
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user role from database
      const user = await supabase
        .from('users')
        .select('role')
        .eq('email', session.user.email)
        .single()

      session.user.role = user.data?.role || 'reviewer'
      return session
    }
  }
}
```

**Role-Based Access**:
- `admin`: Full system access (campaign management, settings, user management)
- `reviewer`: Campaign review and approval only

---

## Content Processing

### RSS Parser
**Purpose**: Parse RSS/Atom feeds from local news sources

**Rationale**:
- **Standard Format**: RSS is universal for content syndication
- **Structured Data**: Title, description, content, images, dates
- **Efficient**: Incremental updates via ETag/Last-Modified headers

**Implementation**:
```typescript
import RSSParser from 'rss-parser'

const parser = new RSSParser()
const feed = await parser.parseURL('https://www.sctimes.com/arc/outboundfeeds/rss/')

for (const item of feed.items) {
  const post = {
    title: item.title,
    description: item.contentSnippet,
    content: item.content,
    image_url: item.enclosure?.url,
    source_url: item.link,
    publication_date: item.pubDate
  }

  // Process with AI evaluation
  const rating = await evaluateContent(post)

  // Store in database
  await createRSSPost(post, rating)
}
```

**Feeds Monitored**:
- St. Cloud Times (local newspaper)
- WJON (local radio station)
- St. Cloud Local (community blog)
- City government feeds
- School district announcements

### Cheerio (HTML Parsing)
**Purpose**: Server-side DOM manipulation for web scraping

**Rationale**:
- **jQuery Syntax**: Familiar API for developers
- **Fast**: Pure JavaScript, no browser required
- **Flexible**: Extract any data from HTML

**Use Cases**:
- Scrape road work data from government websites
- Extract event details from HTML event pages
- Parse Wordle answer from NYT website

### Axios
**Purpose**: HTTP client for external API requests

**Rationale**:
- **Promise-Based**: Modern async/await syntax
- **Interceptors**: Request/response middleware
- **Error Handling**: Automatic retry logic
- **TypeScript Support**: Fully typed responses

---

## UI Components & Styling

### Tailwind CSS 3.3
**Purpose**: Utility-first CSS framework

**Rationale**:
- **Rapid Development**: Build UIs without writing custom CSS
- **Consistency**: Design system enforced through utilities
- **Responsive**: Mobile-first breakpoint system
- **Performance**: Purges unused CSS in production
- **Customization**: Extend default theme with brand colors

**Custom Configuration**:
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3B82F6',
          secondary: '#8B5CF6'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
```

### DND Kit
**Purpose**: Drag-and-drop library for article reordering

**Rationale**:
- **Accessible**: Keyboard and screen reader support
- **Flexible**: Works with any data structure
- **Performant**: Virtual scrolling for large lists
- **TypeScript**: Fully typed

**Implementation**:
```typescript
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

function handleDragEnd(event) {
  const { active, over } = event
  if (active.id !== over.id) {
    // Update article order in database
    await reorderArticles(active.id, over.id)
  }
}
```

### React Image Crop
**Purpose**: Client-side image cropping for ads and events

**Rationale**:
- **User-Friendly**: Visual cropping interface
- **Aspect Ratio**: Enforce 5:4 ratio for ads, 16:9 for articles
- **Preview**: Real-time crop preview
- **Quality**: Maintains image quality during crop

---

## Scheduling & Automation

### Vercel Cron Jobs
**Purpose**: Automated task scheduling

**Rationale**:
- **Serverless**: No separate cron server required
- **Integrated**: Deploy with application code
- **Reliable**: Vercel's infrastructure handles execution
- **Monitoring**: Built-in logging and alerting

**Cron Schedule** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/rss-processing",
      "schedule": "30 20 * * *"
    },
    {
      "path": "/api/cron/create-campaign",
      "schedule": "0 21 * * *"
    },
    {
      "path": "/api/cron/send-final",
      "schedule": "55 4 * * *"
    },
    {
      "path": "/api/cron/sync-events",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/generate-weather",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/generate-road-work",
      "schedule": "0 19 * * *"
    },
    {
      "path": "/api/cron/collect-wordle",
      "schedule": "30 0 * * *"
    },
    {
      "path": "/api/cron/import-metrics",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Custom Schedule Checker
**Purpose**: Prevent duplicate execution and timing conflicts

**Implementation**:
```typescript
// src/lib/schedule-checker.ts
export class ScheduleChecker {
  static shouldRunRSSProcessing(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()

    // Only run between 8:30 PM and 9:00 PM CT
    if (hour === 20 && minute >= 30 && minute < 60) {
      return true
    }
    return false
  }
}
```

---

## Error Monitoring & Logging

### Slack Webhooks
**Purpose**: Real-time error notifications

**Rationale**:
- **Instant Alerts**: Team notified immediately of failures
- **Rich Formatting**: Structured error messages with context
- **Actionable**: Links to logs and affected campaigns
- **Free**: No cost for webhook integrations

**Implementation**:
```typescript
// src/lib/slack.ts
export async function sendErrorNotification(
  message: string,
  context: Record<string, any>
) {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Error: ${message}`,
      attachments: [{
        color: 'danger',
        fields: Object.entries(context).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        }))
      }]
    })
  })
}
```

**Alert Types**:
- RSS processing failures
- AI API errors
- Campaign creation failures
- Email delivery issues
- Image processing errors

### Database Logging
**Purpose**: Persistent audit trail and debugging

**Schema**:
```typescript
interface SystemLog {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  context: Record<string, any>
  source: string | null
  timestamp: string
}
```

**Log Retention**:
- Info logs: 30 days
- Error logs: 90 days
- User activities: Permanent

---

## Payment Processing

### Stripe API
**Purpose**: Payment processing for ads and event submissions

**Rationale**:
- **Industry Standard**: Trusted by millions of businesses
- **Developer-Friendly**: Excellent API and documentation
- **Security**: PCI compliance handled by Stripe
- **Flexible**: Supports one-time and recurring payments
- **Analytics**: Built-in revenue reporting

**Implementation**:
```typescript
// src/app/api/events/create-checkout/route.ts
export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Event Submission Fee',
          description: '1 event featured in St. Cloud Scoop'
        },
        unit_amount: 1000 // $10.00
      },
      quantity: eventCount
    }],
    mode: 'payment',
    success_url: `${domain}/events/submit/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domain}/events/submit`
  })

  return Response.json({ sessionId: session.id })
}
```

**Payment Flows**:
1. **Event Submissions**: $10 per event, one-time payment
2. **Advertisements**: Variable pricing based on frequency (single/weekly/monthly)

**Webhook Handling**:
- `payment_intent.succeeded`: Create event or activate ad
- `payment_intent.failed`: Notify user and cleanup pending records
- `checkout.session.completed`: Finalize submission

---

## Development & Deployment

### Vercel
**Purpose**: Hosting, deployment, and serverless functions

**Rationale**:
- **Zero Config**: Deploy Next.js with single command
- **Edge Network**: Global CDN for fast content delivery
- **Serverless Functions**: Auto-scaling API routes
- **Preview Deployments**: Every Git branch gets unique URL
- **Environment Variables**: Secure secret management
- **Analytics**: Built-in Web Vitals monitoring

**Deployment Process**:
1. Push to GitHub `main` branch
2. Vercel automatically builds and deploys
3. Runs TypeScript compilation
4. Executes database migrations
5. Updates environment variables
6. Rolls out to edge network

**Environment Variables**:
```
# Database
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# AI
OPENAI_API_KEY

# Email
MAILERLITE_API_KEY
MAILERLITE_REVIEW_GROUP_ID
MAILERLITE_MAIN_GROUP_ID

# Authentication
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET

# Payments
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Notifications
SLACK_WEBHOOK_URL

# Image Processing
GOOGLE_CLOUD_VISION_CREDENTIALS
GITHUB_TOKEN

# External APIs
GOOGLE_CALENDAR_API_KEY
WEATHER_API_KEY
```

### Git / GitHub
**Purpose**: Version control and collaboration

**Workflow**:
- `main` branch: Production code
- Feature branches: Development work
- Pull requests: Code review before merge
- Tags: Version releases

### VS Code + Extensions
**Recommended Extensions**:
- ESLint: Code linting
- Prettier: Code formatting
- TypeScript: Language support
- Tailwind CSS IntelliSense: Autocomplete for classes
- GitHub Copilot: AI pair programming

---

## External APIs & Integrations

### Google Calendar API
**Purpose**: Sync events from public St. Cloud calendars

**Implementation**:
```typescript
import { google } from 'googleapis'

const calendar = google.calendar({
  version: 'v3',
  auth: process.env.GOOGLE_CALENDAR_API_KEY
})

const response = await calendar.events.list({
  calendarId: 'stcloud-events@group.calendar.google.com',
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  singleEvents: true,
  orderBy: 'startTime'
})
```

### Weather API
**Purpose**: Local weather forecasts

**Provider**: OpenWeatherMap or WeatherAPI.com

**Data Retrieved**:
- 5-day forecast
- High/low temperatures
- Precipitation probability
- Weather icons/conditions

### Web Scraping Targets
**Road Work Data**:
- MnDOT District 3: https://www.dot.state.mn.us/d3/
- Stearns County: https://www.stearnscountymn.gov/185/Public-Works
- Benton County: https://www.co.benton.mn.us/180/Highway
- Sherburne County: https://www.co.sherburne.mn.us/162/Public-Works
- City of St. Cloud: https://www.ci.stcloud.mn.us
- City of Sartell: https://www.cityofsartell.com/engineering/

**Wordle Data**:
- New York Times Wordle Archive: https://www.nytimes.com/games/wordle/archive

---

## Performance & Scalability

### Current Performance
- **RSS Processing**: 2-5 minutes for 20+ feeds
- **AI Evaluation**: 3-5 seconds per article
- **Newsletter Generation**: 10-15 seconds for full HTML
- **Email Delivery**: 2-3 minutes for 1,000+ subscribers
- **Dashboard Load Time**: <2 seconds

### Scalability Considerations
- **Database**: Supabase scales to millions of rows without configuration
- **Serverless Functions**: Vercel auto-scales based on traffic
- **AI API**: OpenAI handles concurrent requests transparently
- **Email Delivery**: MailerLite supports up to 100,000 subscribers

### Future Optimization Needs
- **Redis Caching**: Cache AI responses, reduce database queries
- **CDN for Images**: Cloudflare for faster image delivery
- **Database Indexes**: Add composite indexes for complex queries
- **Background Jobs**: Queue system for long-running tasks (BullMQ)

---

## Security Considerations

### API Security
- All API routes require authentication (NextAuth middleware)
- Service role keys stored in environment variables
- CORS configured to allow only trusted origins
- Rate limiting on public endpoints (event submissions)

### Data Security
- Passwords never stored (OAuth only)
- Payment data never touches our servers (Stripe handles)
- Subscriber emails encrypted at rest in database
- Row-level security on Supabase tables

### Content Security
- AI fact-checking prevents misinformation
- Human review before final send
- Report error feature for subscriber feedback
- Automated content moderation (Google Vision Safe Search)

---

## Cost Breakdown (Monthly)

### Infrastructure
- **Vercel**: $20/month (Pro plan)
- **Supabase**: Free (under 500MB database)
- **MailerLite**: Free (under 1,000 subscribers), then $10-30/month

### AI & APIs
- **OpenAI**: $50-150/month (depends on volume)
- **Google Cloud Vision**: $10-20/month (image analysis)
- **Weather API**: Free tier sufficient

### Total Monthly Cost
- Current: $80-220/month
- At 5,000 subscribers: $150-300/month
- At 10,000 subscribers: $200-400/month

**Cost per Subscriber**: $0.02-0.04/month

---

## Tech Stack Summary Table

| Layer | Technology | Purpose | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Next.js 15.1.3 | Full-stack React app | Server-side rendering, API routes, Vercel integration |
| **Language** | TypeScript 5.x | Type-safe development | Compile-time errors, better DX |
| **Database** | Supabase (PostgreSQL) | Primary data store | Managed, real-time, generous free tier |
| **AI** | OpenAI GPT-4o | Content generation | Best-in-class language model |
| **Email** | MailerLite | Newsletter delivery | High deliverability, analytics |
| **Auth** | NextAuth.js | User authentication | Zero config, Google OAuth |
| **Styling** | Tailwind CSS | UI framework | Rapid development, consistent design |
| **Payments** | Stripe | Payment processing | Industry standard, secure |
| **Hosting** | Vercel | Deployment platform | Serverless, edge network, Git integration |
| **Images** | GitHub | Image storage | Free CDN, reliable |
| **Monitoring** | Slack Webhooks | Error alerts | Real-time notifications |
| **Scheduling** | Vercel Cron | Automated tasks | Serverless cron jobs |

---

## Alternative Technologies Considered

### Why Not WordPress?
- **Custom Logic**: Newsletter automation requires extensive custom code
- **Performance**: PHP slower than JavaScript for serverless functions
- **AI Integration**: Node.js ecosystem better for OpenAI SDK

### Why Not Substack?
- **Control**: Need full control over content pipeline and AI processing
- **Monetization**: Substack takes 10% of revenue; we keep 100%
- **Automation**: Substack doesn't support AI content curation

### Why Not AWS Lambda?
- **Complexity**: Vercel provides simpler developer experience
- **Cost**: Vercel free tier more generous for small projects
- **Ecosystem**: Next.js optimized for Vercel deployment

### Why Not Firebase?
- **SQL**: Need relational database for complex queries
- **Cost**: Supabase more cost-effective at scale
- **Ecosystem**: PostgreSQL better for analytics and reporting

---

## Future Tech Considerations

### Potential Additions
- **Redis**: Caching layer for performance optimization
- **Elasticsearch**: Advanced search capabilities
- **Kafka**: Event streaming for real-time analytics
- **Kubernetes**: Multi-tenant scaling for city expansion
- **Snowflake**: Data warehouse for business intelligence

### Evaluation Criteria
- **Value vs. Complexity**: Only add tech that significantly improves product
- **Team Expertise**: Prefer technologies team already knows
- **Cost**: Balance performance gains against monthly expenses
- **Vendor Lock-In**: Prefer open-source or easily replaceable solutions
