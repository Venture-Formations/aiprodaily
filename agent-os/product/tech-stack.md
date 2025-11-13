# Technology Stack - AI Pros Newsletter Platform

## Overview

AI Pros Newsletter is built on a modern, scalable technology stack optimized for multi-tenant SaaS newsletter automation. Our architecture prioritizes AI integration, developer velocity, and operational efficiency, enabling a small team to manage dozens of professional newsletters with minimal manual intervention.

---

## Core Framework & Runtime

### Next.js 15.1.3 (App Router)
**Purpose**: Full-stack React framework for multi-tenant web application

**Why Next.js**:
- **Server-Side Rendering**: Optimal SEO and fast page loads for public newsletter archives
- **API Routes**: Built-in backend without separate server infrastructure
- **File-Based Routing**: Intuitive organization with dynamic routes (`/dashboard/[slug]` for multi-tenancy)
- **App Router**: Modern React Server Components for improved performance and streaming
- **Vercel Integration**: Zero-config deployment with serverless functions
- **Middleware**: Request interception for subdomain-based newsletter detection
- **TypeScript Support**: First-class TypeScript integration out of the box

**Key Features Used**:
- API route handlers (`/api/*`) for all backend operations
- Server-side data fetching with async/await
- Middleware for multi-tenant context propagation
- Dynamic routes for newsletters (`/dashboard/[slug]`)
- Edge runtime for global performance

### TypeScript 5.x
**Purpose**: Type-safe development across entire codebase

**Why TypeScript**:
- **Type Safety**: Catch database schema mismatches and API errors at compile time
- **Developer Experience**: IntelliSense autocomplete for all 30+ database tables
- **Refactoring Confidence**: Rename fields across 100+ files with certainty
- **Self-Documenting**: Type definitions serve as inline documentation
- **Team Coordination**: Shared interfaces prevent integration bugs between features

**Database Type System**:
- All database schemas defined in `src/types/database.ts`
- 50+ TypeScript interfaces covering entire data model
- Newsletter, Campaign, Article, RssPost, Event, AIApplication, PromptIdea, etc.
- Type-safe API responses with proper error handling

**Strict Mode Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### React 18
**Purpose**: Component-based user interface library

**Why React 18**:
- **Component Reusability**: Modular UI components across all newsletters
- **Hooks**: Clean state management with useState, useEffect, useContext
- **Concurrent Rendering**: Automatic batching and transitions for smoother UX
- **Server Components**: Next.js App Router leverages React 18 streaming
- **Ecosystem**: Massive library ecosystem (DND Kit, React Image Crop, etc.)

**Key UI Patterns**:
- Newsletter context provider (`NewsletterContext`) for multi-tenant branding
- Campaign management dashboard with real-time updates
- Drag-and-drop article reordering with visual feedback
- Image cropping interface for advertisements
- Analytics charts and performance metrics
- Event and AI app selection interfaces

---

## Database & Data Storage

### Supabase (PostgreSQL 15)
**Purpose**: Primary database and backend-as-a-service

**Why Supabase**:
- **Managed PostgreSQL**: Enterprise-grade database without DevOps overhead
- **Real-Time Subscriptions**: WebSocket support for live updates (future feature)
- **Row-Level Security**: Database-level authorization for multi-tenancy
- **RESTful API**: Auto-generated API from schema (not currently used)
- **Edge Functions**: Serverless functions close to database (Deno runtime)
- **Storage**: Integrated object storage (currently using GitHub instead)
- **Free Tier**: Generous limits for early-stage development

**Multi-Tenant Database Architecture**:
```sql
-- Core multi-tenancy table
CREATE TABLE newsletters (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#3B82F6'
);

-- All content tables include newsletter_id
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY,
  newsletter_id UUID REFERENCES publications(id),
  url TEXT NOT NULL,
  -- other fields
);

CREATE TABLE ai_applications (
  id UUID PRIMARY KEY,
  newsletter_id UUID REFERENCES publications(id),
  app_name TEXT NOT NULL,
  -- other fields
);
```

**Database Schema** (30+ tables):
- **Multi-Tenancy**: `newsletters`, `newsletter_settings`
- **Campaign Management**: `newsletter_campaigns`, `campaign_events`, `campaign_ai_app_selections`, `campaign_prompt_selections`
- **Content Pipeline**: `rss_feeds`, `rss_posts`, `post_ratings`, `articles`, `manual_articles`
- **AI Content**: `ai_applications`, `prompt_ideas`
- **Monetization**: `advertisements`, `campaign_advertisements`
- **Analytics**: `email_metrics`, `article_performance`, `link_clicks`
- **System**: `users`, `user_activities`, `system_logs`, `app_settings`

**Performance Optimizations**:
- Composite indexes on frequently queried columns (`newsletter_id`, `campaign_id`, `date`)
- JSONB columns for flexible data (`email_metrics`, `post_rating`, `user_activities`)
- Foreign key constraints maintain referential integrity
- Cascade deletes for campaign cleanup

**Connection Pattern**:
```typescript
// Admin client (bypasses RLS) for server-side operations
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Query with newsletter filtering
const { data } = await supabaseAdmin
  .from('ai_applications')
  .select('*')
  .eq('newsletter_id', newsletterId)
  .eq('is_active', true)
  .order('last_used_date', { ascending: true })
  .limit(5)
```

### GitHub (Image Storage & CDN)
**Purpose**: Reliable, free image hosting with global CDN

**Why GitHub over Supabase Storage**:
- **Zero Cost**: Unlimited bandwidth for public repositories
- **Global CDN**: GitHub Pages CDN for fast image delivery worldwide
- **Version Control**: Image history tracked in Git commits
- **Programmatic Access**: Octokit REST API for uploads
- **Reliability**: GitHub's 99.95% uptime SLA
- **No Vendor Lock-In**: Images portable to any CDN if needed

**Implementation Details**:
```typescript
import { Octokit } from '@octokit/rest'

export async function uploadImageToGitHub(
  imageBuffer: Buffer,
  fileName: string,
  path: string
): Promise<string> {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
  const content = imageBuffer.toString('base64')

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner: 'aipros-newsletter',
    repo: 'images',
    path: `${path}/${fileName}`,
    message: `Upload: ${fileName}`,
    content,
    committer: {
      name: 'AI Pros Bot',
      email: 'bot@aipros.com'
    }
  })

  return `https://raw.githubusercontent.com/aipros-newsletter/images/main/${path}/${fileName}`
}
```

**Image Processing Pipeline**:
1. **RSS Image Handling**:
   - Detect Facebook CDN URLs (temporary auth tokens)
   - Download immediately to prevent expiration
   - Resize to optimal dimensions (800px width, 16:9 ratio)
   - Upload to GitHub repository
   - Store CDN URL in database

2. **Advertisement Images**:
   - User uploads via browser file input
   - Client-side cropping (5:4 aspect ratio)
   - Upload to GitHub via API
   - Generate multiple sizes (thumbnail, full)
   - Store both URLs in database

3. **Event Images**:
   - Import from Google Calendar
   - Crop to 16:9 ratio with vertical offset control
   - Upload to GitHub
   - Cache CDN URL

---

## AI & Machine Learning

### OpenAI API (GPT-4o)
**Purpose**: Natural language understanding, generation, and evaluation

**Why OpenAI GPT-4o**:
- **State-of-the-Art Performance**: Best-in-class language model for content evaluation
- **Structured JSON Output**: Reliable, parseable responses for programmatic use
- **Reasoning Capabilities**: Understands professional context (accounting vs. legal vs. medical)
- **Function Calling**: Structured tool use for data extraction
- **Vision API**: Image analysis capabilities (future feature)
- **Cost-Effective**: $5 per 1M input tokens, $15 per 1M output tokens

**AI Operations** (8 Core Prompts):

#### 1. Content Evaluator (`contentEvaluator`)
**Purpose**: Rate articles for professional relevance
```typescript
interface ContentEvaluation {
  interest_level: number    // 1-20: Newsworthiness and reader appeal
  local_relevance: number   // 1-10: Professional relevance (customized per newsletter)
  community_impact: number  // 1-10: Effect on professional workflows
  reasoning: string         // Explanation of scores
}
```

**Customization per Newsletter**:
- Accounting: Prioritizes tax law, audit standards, accounting software
- Legal: Focus on case law, regulatory changes, practice management
- Medical: Clinical trials, treatment protocols, healthcare policy

**Exclusion Filters**:
- Lost pet posts
- Outdated events
- Duplicate announcements
- Clickbait content

#### 2. Newsletter Writer (`newsletterWriter`)
**Purpose**: Rewrite articles into newsletter format (40-75 words)

**Editorial Guidelines**:
- Third-person perspective, journalistic voice
- No "today" or "tomorrow" (date-agnostic)
- No URLs or external references
- Active voice, engaging headlines
- Professional tone appropriate to audience

**Quality Controls**:
- Word count enforcement (40-75 words)
- Headline creativity (don't copy original title)
- No editorial commentary or opinion

#### 3. Fact Checker (`factChecker`)
**Purpose**: Validate newsletter content against source material

**Scoring System** (0-30 points):
- **Accuracy**: Does content match source facts? (0-20 points)
- **Additions**: Any information not in source? (-5 points per violation)
- **Prohibited Words**: "today", "tomorrow", URLs present? (-3 points per violation)
- **Tone**: Inappropriate editorial commentary? (-5 points)

**Passing Threshold**: 20/30 minimum score
**Failure Action**: Regenerate article with stricter constraints

#### 4. Topic Deduplicator (`topicDeduper`)
**Purpose**: Identify duplicate stories across RSS sources

**Detection Logic**:
- Semantic similarity analysis
- Topic signature generation
- Cross-source duplicate grouping
- Primary article selection (highest score)

**Output**:
```typescript
interface DuplicationResult {
  has_duplicates: boolean
  primary_article_index: number
  duplicate_indices: number[]
  topic_signature: string
}
```

#### 5. Subject Line Generator (`subjectLineGenerator`)
**Purpose**: Create compelling email subject lines

**Constraints**:
- Maximum 35 characters (allows room for emoji prefix)
- Front-page newspaper headline style
- Breaking news voice, urgency
- No colons, em dashes, year references
- No "today" or "tomorrow"

**Generation Strategy**:
- Analyze top article headline and content
- Create 3 variations
- Select most engaging option
- Auto-regenerate when #1 article changes

#### 6. Event Summarizer (`eventSummarizer`)
**Purpose**: Convert verbose event descriptions to 50-word highlights

**Output Format**:
- Natural language paraphrasing
- Capture event appeal and key details
- Avoid marketing jargon
- Professional, informative tone

#### 7. Image Analyzer (`imageAnalyzer`)
**Purpose**: Generate captions, alt text, and tags for images

**Capabilities**:
- AI caption generation (1-2 sentences)
- Accessibility-focused alt text
- Multi-tag extraction (location, scene, objects, mood, style)
- OCR text extraction
- Age group detection
- Safety scoring

#### 8. Breaking News Scorer (`breakingNewsScorer`)
**Purpose**: Detect time-sensitive content requiring prioritization

**Scoring Criteria** (1-10):
- Time sensitivity (must act today vs. this week)
- Professional impact (affects workflows immediately)
- Regulatory urgency (compliance deadlines)
- Market-moving news (financial implications)

**Categories**:
- Regulatory Change
- Technology Launch
- Market Update
- Crisis Response
- Industry Event

**Prompt Management System**:
```typescript
// Prompts stored in database for easy updates
await supabaseAdmin
  .from('newsletter_settings')
  .select('value')
  .eq('newsletter_id', newsletterId)
  .eq('key', 'ai_prompt_content_evaluator')
  .single()

// Fallback to hardcoded prompts if database empty
const prompt = dbPrompt || DEFAULT_PROMPTS.contentEvaluator
```

**Cost Management**:
- Token limits (1000 tokens per operation)
- Batch processing where possible
- Result caching (road work data, event summaries)
- Monthly budget alerts via Vercel environment variables

### Google Cloud Vision API 5.3.3
**Purpose**: Image analysis, tagging, and content moderation

**Why Google Cloud Vision**:
- **Superior Image Understanding**: Best-in-class computer vision
- **Label Detection**: Automatic image tagging (50+ labels per image)
- **Face Detection**: Count people, detect age groups
- **Text Detection (OCR)**: Extract venue names, signage text
- **Safe Search**: Content moderation (adult, violence, medical)
- **Color Analysis**: Dominant colors for theming
- **Landmark Detection**: Identify famous locations
- **Logo Detection**: Recognize brands (future feature)

**Use Cases**:
- Automatic image tagging for searchability
- Age-appropriate content filtering for newsletters
- Venue identification from signage
- Image quality scoring (blurriness, exposure)
- Accessibility compliance (alt text generation)

**Implementation**:
```typescript
import vision from '@google-cloud/vision'

const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_VISION_CREDENTIALS!)
})

const [result] = await client.annotateImage({
  image: { source: { imageUri: imageUrl } },
  features: [
    { type: 'LABEL_DETECTION', maxResults: 20 },
    { type: 'FACE_DETECTION' },
    { type: 'TEXT_DETECTION' },
    { type: 'SAFE_SEARCH_DETECTION' },
    { type: 'IMAGE_PROPERTIES' }
  ]
})
```

**Cost** (per 1,000 images):
- Label Detection: $1.50
- Face Detection: $1.50
- Text Detection: $1.50
- Safe Search: $1.50
- Total: ~$6 per 1,000 images analyzed

---

## Email Delivery

### MailerLite API
**Purpose**: Email service provider for newsletter delivery

**Why MailerLite**:
- **High Deliverability**: 99%+ inbox placement rate
- **API-First Design**: Comprehensive REST API for automation
- **Rich Analytics**: Open rates, click rates, bounce tracking, device data
- **Subscriber Management**: Groups, segments, custom fields, tags
- **Template Editor**: Visual editor for email design (not used - we generate HTML)
- **Affordable Pricing**:
  - Free: Up to 1,000 subscribers
  - Growth: $9-29/month for 1,000-10,000 subscribers
  - Advanced: $19-79/month for 10,000+ subscribers

**Multi-Newsletter Architecture**:
Each newsletter has separate MailerLite groups:
- Review Group: Internal team for 9 PM preview
- Main Subscriber Group: Public audience for 5 AM final send

**Campaign Creation Flow**:
```typescript
// Create MailerLite campaign
const response = await fetch('https://api.mailerlite.com/api/v2/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY!
  },
  body: JSON.stringify({
    type: 'regular',
    subject: `🤖 ${subjectLine}`,  // Emoji varies per newsletter
    from: newsletterSettings.from_email,
    from_name: newsletterSettings.sender_name,
    groups: [groupId],
    content: htmlContent
  })
})

// Schedule sending
await fetch(`https://api.mailerlite.com/api/v2/campaigns/${campaignId}/actions/send`, {
  method: 'POST',
  body: JSON.stringify({
    date: '2024-10-15 05:00:00',  // Central Time, converted to UTC
    timezone: 'America/Chicago'
  })
})
```

**Automated Email Workflow**:
1. **8:30 PM CT**: RSS processing generates campaign
2. **9:00 PM CT**: Review email sent to internal team
3. **9 PM - 5 AM CT**: Team reviews and modifies
4. **4:55 AM CT**: Final newsletter sent to all subscribers

**Metrics Import**:
```typescript
// Daily import of campaign metrics
const metrics = await fetch(
  `https://api.mailerlite.com/api/v2/campaigns/${campaignId}/stats`
)

await supabaseAdmin.from('email_metrics').insert({
  campaign_id: campaignId,
  mailerlite_campaign_id: mlCampaignId,
  sent_count: metrics.sent,
  opened_count: metrics.opened_unique,
  clicked_count: metrics.clicked_unique,
  bounced_count: metrics.bounced,
  unsubscribed_count: metrics.unsubscribed,
  open_rate: (metrics.opened_unique / metrics.sent) * 100,
  click_rate: (metrics.clicked_unique / metrics.sent) * 100
})
```

**Click Tracking**:
- MailerLite automatically tracks link clicks
- Custom tracking parameters for AI apps: `?utm_source=newsletter&utm_campaign=accounting_daily&utm_content=app_quickbooks`
- Link performance stored in `link_clicks` table

---

## Authentication & Authorization

### NextAuth.js 4.24.6
**Purpose**: Authentication library for Next.js

**Why NextAuth**:
- **Zero Config**: Works seamlessly with Next.js App Router
- **Multiple Providers**: Google OAuth (current), GitHub, email (future)
- **Session Management**: JWT tokens with automatic refresh
- **Security**: CSRF protection, secure cookies, XSS prevention
- **TypeScript**: Fully typed session and user objects
- **Database Integration**: User records synced to Supabase

**Authentication Flow**:
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Create/update user in database
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single()

      if (!existingUser) {
        await supabaseAdmin.from('users').insert({
          email: user.email,
          name: user.name,
          role: 'reviewer',  // Default role
          last_login: new Date().toISOString()
        })
      }

      return true
    },
    async session({ session, token }) {
      // Attach user role to session
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role, id')
        .eq('email', session.user.email)
        .single()

      session.user.role = user?.role || 'reviewer'
      session.user.id = user?.id

      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
}
```

**Role-Based Access Control**:
- **Admin**: Full platform access (newsletter creation, settings, user management)
- **Reviewer**: Campaign review and approval (cannot modify settings)
- **Publisher** (future): Manage own newsletters only

**Protected Routes**:
```typescript
// Middleware protection
import { getServerSession } from 'next-auth'

export async function middleware(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}
```

---

## Content Processing

### RSS Parser 3.13.0
**Purpose**: Parse RSS/Atom feeds from professional news sources

**Why RSS Parser**:
- **Standard Format**: Universal content syndication protocol
- **Structured Data**: Title, description, content, images, dates
- **Incremental Updates**: ETag/Last-Modified headers for efficiency
- **Format Agnostic**: Supports RSS 2.0, Atom, and custom formats

**Usage Pattern**:
```typescript
import RSSParser from 'rss-parser'

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded']
    ]
  }
})

const feed = await parser.parseURL('https://accountingtoday.com/feed')

for (const item of feed.items) {
  const rssPost = {
    feed_id: feedId,
    campaign_id: campaignId,
    external_id: item.guid || item.link,
    title: item.title,
    description: item.contentSnippet?.substring(0, 500),
    content: item.contentEncoded || item.content,
    author: item.creator || item.author,
    publication_date: item.pubDate,
    source_url: item.link,
    image_url: item.enclosure?.url || item.media?.url
  }

  // Process with AI evaluation
  const rating = await evaluateContent(rssPost)

  // Store in database
  await createRSSPost(rssPost, rating)
}
```

**Professional RSS Sources** (by newsletter type):

**Accounting AI Daily**:
- Journal of Accountancy RSS
- Accounting Today feed
- CPA Practice Advisor
- AICPA news feed
- IRS Tax Updates
- QuickBooks blog
- Xero blog

**Legal AI Daily** (planned):
- ABA Journal
- Law.com feeds
- Legal Tech News
- Thomson Reuters
- LexisNexis blog

**Medical AI Daily** (planned):
- JAMA Network
- New England Journal of Medicine
- MedPage Today
- Healthcare IT News

### Cheerio 1.1.2
**Purpose**: Server-side HTML parsing and web scraping

**Why Cheerio**:
- **jQuery-Like API**: Familiar selectors for developers
- **Fast**: Pure JavaScript, no browser overhead
- **Flexible**: Extract any data from HTML
- **Lightweight**: Minimal dependencies

**Use Cases**:
```typescript
import * as cheerio from 'cheerio'
import axios from 'axios'

// 1. Scrape Wordle answer from NYT
const html = await axios.get('https://www.nytimes.com/games/wordle/archive')
const $ = cheerio.load(html.data)

const wordleAnswer = $('.wordle-answer').text()
const definition = $('.definition').text()

// 2. Extract event details from HTML
const eventHtml = await axios.get(eventUrl)
const $event = cheerio.load(eventHtml.data)

const eventData = {
  title: $event('h1.event-title').text(),
  date: $event('.event-date').attr('datetime'),
  venue: $event('.venue-name').text(),
  description: $event('.event-description').html()
}

// 3. Parse road work data from government sites
const roadWorkHtml = await axios.get('https://www.dot.state.mn.us/d3/')
const $road = cheerio.load(roadWorkHtml.data)

$road('.road-closure').each((i, elem) => {
  const closure = {
    road: $road(elem).find('.road-name').text(),
    reason: $road(elem).find('.closure-reason').text(),
    dates: $road(elem).find('.closure-dates').text()
  }
})
```

### Axios 1.6.7
**Purpose**: HTTP client for external API requests

**Why Axios**:
- **Promise-Based**: Clean async/await syntax
- **Interceptors**: Request/response middleware
- **Error Handling**: Automatic retry logic with exponential backoff
- **TypeScript**: Fully typed responses
- **Timeout Control**: Prevent hanging requests

**Configuration**:
```typescript
import axios from 'axios'

const api = axios.create({
  timeout: 10000,  // 10 second timeout
  headers: {
    'User-Agent': 'AI Pros Newsletter Bot/1.0'
  }
})

// Retry logic for transient failures
api.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config

    if (!config || !config.retry) {
      return Promise.reject(error)
    }

    config.retryCount = config.retryCount || 0

    if (config.retryCount >= config.retry) {
      return Promise.reject(error)
    }

    config.retryCount += 1

    const delay = Math.pow(2, config.retryCount) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    return api(config)
  }
)
```

---

## UI Components & Styling

### Tailwind CSS 3.3.0
**Purpose**: Utility-first CSS framework

**Why Tailwind**:
- **Rapid Development**: Build UIs without writing custom CSS
- **Consistency**: Design system enforced through utilities
- **Responsive**: Mobile-first breakpoint system
- **Performance**: Purges unused CSS in production (reduces bundle 90%+)
- **Customization**: Extend default theme with brand colors per newsletter
- **Dark Mode**: Class-based dark mode support

**Multi-Newsletter Theming**:
```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        // Dynamically set per newsletter
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
```

**Component Pattern**:
```tsx
// Newsletter branding via CSS variables
export function NewsletterLayout({ children, newsletter }) {
  return (
    <div
      style={{
        '--color-primary': newsletter.primary_color,
        '--color-secondary': newsletter.secondary_color
      }}
    >
      {children}
    </div>
  )
}
```

### DND Kit 6.3.1
**Purpose**: Drag-and-drop library for article reordering

**Why DND Kit**:
- **Accessible**: Keyboard and screen reader support (WCAG 2.1 AA)
- **Performant**: Virtual scrolling for large lists
- **Flexible**: Works with any data structure
- **TypeScript**: Fully typed
- **Modular**: Import only needed features

**Implementation**:
```tsx
import { DndContext, closestCenter, PointerSensor, useSensor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

function ArticleReorderList({ articles }) {
  const [items, setItems] = useState(articles)
  const sensors = [useSensor(PointerSensor)]

  function handleDragEnd(event) {
    const { active, over } = event

    if (active.id !== over.id) {
      setItems(items => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)

        const reordered = arrayMove(items, oldIndex, newIndex)

        // Save to database
        updateArticleOrder(reordered)

        return reordered
      })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map(article => (
          <SortableArticle key={article.id} article={article} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

### React Image Crop 11.0.10
**Purpose**: Client-side image cropping for ads and events

**Why React Image Crop**:
- **User-Friendly**: Visual cropping interface
- **Aspect Ratio Enforcement**: 5:4 for ads, 16:9 for articles, 1:1 for logos
- **Real-Time Preview**: See crop result before uploading
- **Quality Preservation**: Lossless crop operation
- **Touch Support**: Mobile-friendly

**Usage**:
```tsx
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

function ImageCropper({ imageUrl, aspectRatio = 5/4 }) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    aspect: aspectRatio
  })

  const [completedCrop, setCompletedCrop] = useState<Crop>()

  async function handleCropComplete() {
    if (!completedCrop) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const image = new Image()
    image.src = imageUrl

    // Calculate crop dimensions
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = completedCrop.width * scaleX
    canvas.height = completedCrop.height * scaleY

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )

    // Convert to blob and upload
    canvas.toBlob(async blob => {
      await uploadCroppedImage(blob)
    }, 'image/jpeg', 0.95)
  }

  return (
    <ReactCrop
      crop={crop}
      onChange={c => setCrop(c)}
      onComplete={c => setCompletedCrop(c)}
      aspect={aspectRatio}
    >
      <img src={imageUrl} alt="Crop preview" />
    </ReactCrop>
  )
}
```

---

## Scheduling & Automation

### Vercel Cron Jobs
**Purpose**: Serverless task scheduling without dedicated cron server

**Why Vercel Cron**:
- **Serverless**: No infrastructure management
- **Integrated**: Deploy with application code
- **Reliable**: Vercel's edge network handles execution
- **Monitoring**: Built-in logging via Vercel dashboard
- **Global**: Runs from nearest edge location

**Cron Schedule** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/rss-processing",
      "schedule": "30 20 * * *"  // 8:30 PM CT daily
    },
    {
      "path": "/api/cron/create-campaign",
      "schedule": "0 21 * * *"  // 9:00 PM CT daily
    },
    {
      "path": "/api/cron/send-final",
      "schedule": "55 4 * * *"  // 4:55 AM CT daily
    },
    {
      "path": "/api/cron/import-metrics",
      "schedule": "0 8 * * *"  // 8:00 AM CT daily
    }
  ]
}
```

**Cron Endpoint Pattern**:
```typescript
// Vercel cron makes GET requests without auth headers
export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // Execute scheduled task
    await processRSSFeeds()

    return Response.json({ success: true })
  } catch (error) {
    // Log error and notify team
    await logError(error)
    await sendSlackAlert(error)

    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

**Timeout Handling**:
- Vercel function timeout: 60 seconds (Hobby), 300 seconds (Pro)
- Long-running tasks (RSS processing) split into chunks
- Background jobs for non-blocking operations

---

## Error Monitoring & Logging

### Slack Webhooks
**Purpose**: Real-time error notifications to team

**Why Slack**:
- **Instant Alerts**: Team notified within seconds of failures
- **Rich Formatting**: Structured error messages with context
- **Actionable**: Direct links to logs and affected campaigns
- **Free**: No cost for webhook integrations
- **Mobile**: Push notifications on team phones

**Implementation**:
```typescript
export async function sendSlackAlert(
  message: string,
  context: Record<string, any>,
  severity: 'info' | 'warning' | 'error' = 'error'
) {
  const colors = {
    info: '#36a64f',
    warning: '#ff9800',
    error: '#f44336'
  }

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${severity === 'error' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️'} ${message}`,
      attachments: [{
        color: colors[severity],
        fields: Object.entries(context).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })),
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  })
}
```

**Alert Types**:
- RSS processing failures (feed unreachable, parsing errors)
- AI API errors (rate limits, timeouts, invalid responses)
- Campaign creation failures (missing data, database errors)
- Email delivery issues (MailerLite API errors)
- Image processing errors (download failures, upload failures)
- Cron job failures (timeout, authentication errors)

### Database Logging (`system_logs` table)
**Purpose**: Persistent audit trail and debugging

**Schema**:
```typescript
interface SystemLog {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  context: Record<string, any>  // JSONB column
  source: string | null
  timestamp: string
}
```

**Logging Helper**:
```typescript
export async function logEvent(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: Record<string, any> = {},
  source: string | null = null
) {
  await supabaseAdmin.from('system_logs').insert({
    level,
    message,
    context,
    source,
    timestamp: new Date().toISOString()
  })

  // Also send to Slack for errors
  if (level === 'error') {
    await sendSlackAlert(message, context, 'error')
  }
}
```

**User Activity Tracking**:
```typescript
interface UserActivity {
  id: string
  user_id: string
  campaign_id: string
  action: string  // 'article_skipped', 'article_reordered', 'campaign_approved'
  details: Record<string, any>  // Action-specific metadata
  timestamp: string
}

// Track all editorial actions
await supabaseAdmin.from('user_activities').insert({
  user_id: session.user.id,
  campaign_id: campaignId,
  action: 'article_skipped',
  details: {
    article_id: articleId,
    article_headline: article.headline,
    reason: 'outdated'
  }
})
```

**Log Retention Policy**:
- Info logs: 30 days
- Warning logs: 60 days
- Error logs: 90 days
- User activities: Permanent (business intelligence)

---

## Payment Processing

### Stripe API (Future Feature)
**Purpose**: Payment processing for publisher subscriptions and ads

**Planned Implementation**:
- **Publisher Subscriptions**: Monthly billing for platform access
- **Advertisement Payments**: One-time or recurring ad placements
- **Revenue Sharing**: Stripe Connect for publisher payouts

**Subscription Tiers** (planned):
```typescript
const SUBSCRIPTION_TIERS = {
  free: {
    price: 0,
    newsletters: 1,
    subscribers: 1000,
    features: ['Platform branding', 'Basic analytics']
  },
  pro: {
    price: 9900,  // $99/month in cents
    newsletters: 5,
    subscribers: 10000,
    features: ['Custom branding', 'Advanced analytics', 'API access']
  },
  enterprise: {
    price: 49900,  // $499/month in cents
    newsletters: -1,  // Unlimited
    subscribers: -1,  // Unlimited
    features: ['White-label', 'Dedicated support', 'SLA', 'Custom integrations']
  }
}
```

---

## Development & Deployment

### Vercel Platform
**Purpose**: Hosting, deployment, and serverless infrastructure

**Why Vercel**:
- **Zero-Config**: Deploy Next.js with `git push`
- **Edge Network**: Global CDN for sub-100ms response times
- **Serverless Functions**: Auto-scaling API routes (0 to millions of requests)
- **Preview Deployments**: Every Git branch gets unique URL for testing
- **Environment Variables**: Secure secret management with production/preview separation
- **Analytics**: Built-in Web Vitals monitoring
- **Logs**: Real-time function logs and error tracking

**Deployment Process**:
1. Developer pushes to GitHub `main` branch
2. Vercel webhook triggers build
3. TypeScript compilation and type checking
4. Next.js production build
5. Serverless functions bundled
6. Edge network deployment (global rollout)
7. Old version remains live until new version ready (zero-downtime)

**Environment Variables** (Production):
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI
OPENAI_API_KEY=sk-proj-...

# Email
MAILERLITE_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...

# Authentication
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXTAUTH_SECRET=random-64-char-string
NEXTAUTH_URL=https://aiprodaily.vercel.app

# Payments (future)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/...

# Image Processing
GOOGLE_CLOUD_VISION_CREDENTIALS={"type":"service_account",...}
GITHUB_TOKEN=ghp_...

# Security
CRON_SECRET=random-secret-for-cron-auth
```

**Performance Monitoring**:
- Vercel Analytics: Core Web Vitals (LCP, FID, CLS)
- Real User Monitoring (RUM): P50, P75, P99 latencies
- Function logs: Execution time, memory usage, cold starts

### Git & GitHub
**Purpose**: Version control and team collaboration

**Workflow**:
- `main` branch: Production code (auto-deploys to Vercel)
- `develop` branch: Staging environment (preview deployments)
- Feature branches: `feature/newsletter-templates`, `bugfix/email-encoding`
- Pull requests: Code review before merge (require 1 approval)
- Tags: Version releases (`v1.0.0`, `v1.1.0`)

**Commit Conventions** (Conventional Commits):
```bash
feat: Add newsletter creation wizard
fix: Resolve image upload timeout issues
docs: Update README with multi-tenant setup
refactor: Extract AI prompts to database
perf: Optimize RSS processing with parallel fetching
test: Add unit tests for content evaluator
```

---

## Tech Stack Summary Table

| Layer | Technology | Version | Purpose | Rationale |
|-------|-----------|---------|---------|-----------|
| **Framework** | Next.js | 15.1.3 | Full-stack React app | SSR, API routes, Vercel integration |
| **Language** | TypeScript | 5.x | Type-safe development | Compile-time errors, better DX |
| **UI Library** | React | 18 | Component-based UI | Hooks, server components |
| **Database** | Supabase (PostgreSQL) | 15 | Primary data store | Managed, real-time, multi-tenant |
| **AI - LLM** | OpenAI GPT-4o | 4.28.0 | Content generation | Best-in-class reasoning |
| **AI - Vision** | Google Cloud Vision | 5.3.3 | Image analysis | Superior computer vision |
| **Email** | MailerLite | API v2 | Newsletter delivery | High deliverability, analytics |
| **Auth** | NextAuth.js | 4.24.6 | User authentication | Zero config, Google OAuth |
| **Styling** | Tailwind CSS | 3.3.0 | UI framework | Rapid development, theming |
| **DnD** | DND Kit | 6.3.1 | Drag-and-drop | Accessible, performant |
| **Image Crop** | React Image Crop | 11.0.10 | Client-side cropping | User-friendly, quality |
| **Payments** | Stripe | TBD | Payment processing | Industry standard, secure |
| **Hosting** | Vercel | N/A | Deployment platform | Serverless, edge, Git integration |
| **Images** | GitHub | N/A | Image CDN | Free, reliable, global |
| **Monitoring** | Slack Webhooks | N/A | Error alerts | Real-time, free |
| **Scheduling** | Vercel Cron | N/A | Automated tasks | Serverless cron jobs |
| **RSS** | rss-parser | 3.13.0 | Feed parsing | Standard, flexible |
| **HTTP** | Axios | 1.6.7 | API requests | Promise-based, retries |
| **HTML Parse** | Cheerio | 1.1.2 | Web scraping | jQuery-like, fast |

---

## Cost Breakdown (Monthly Estimate)

### Infrastructure
- **Vercel Pro**: $20/month (required for longer function timeouts)
- **Supabase Pro**: $25/month (when exceeding 500MB database)
- **MailerLite Growth**: $9-29/month (scales with subscribers)

### AI & APIs
- **OpenAI**: $100-300/month (depends on newsletter count and RSS volume)
- **Google Cloud Vision**: $20-50/month (image analysis for new content)

### Storage & CDN
- **GitHub**: Free (public repository for images)

### Total Monthly Cost
- **1 Newsletter (5K subscribers)**: $180-400/month ($0.04-0.08 per subscriber)
- **10 Newsletters (50K subscribers)**: $400-700/month ($0.008-0.014 per subscriber)
- **50 Newsletters (250K subscribers)**: $800-1,500/month ($0.003-0.006 per subscriber)

**Unit Economics**: Cost per subscriber decreases significantly with scale due to shared infrastructure.

---

## Alternative Technologies Considered

### Why Not WordPress?
- **Custom Logic**: Newsletter automation requires extensive custom code (plugins insufficient)
- **Performance**: PHP slower than Node.js for serverless AI operations
- **AI SDK**: JavaScript ecosystem better for OpenAI SDK integration
- **Scaling**: WordPress multi-site complex for true multi-tenancy

### Why Not Substack or Beehiiv?
- **Control**: Need full control over AI content pipeline
- **Monetization**: Platforms take 10% revenue; we keep 100%
- **Automation**: No platforms support AI-powered RSS curation
- **Multi-Tenancy**: Can't manage 50+ newsletters from one account

### Why Not AWS Lambda?
- **Complexity**: Vercel simpler developer experience (fewer config files)
- **Cost**: Vercel free tier more generous for prototyping
- **Ecosystem**: Next.js optimized specifically for Vercel

### Why Not Firebase/Firestore?
- **SQL Needs**: Relational database critical for complex joins and analytics
- **Cost**: Supabase more cost-effective at scale (predictable pricing)
- **Ecosystem**: PostgreSQL better for data export and business intelligence

### Why Not Claude API Instead of OpenAI?
- **Function Calling**: OpenAI's structured outputs more reliable for JSON parsing
- **Cost**: GPT-4o cheaper per token than Claude 3.5 Sonnet
- **Latency**: OpenAI API slightly faster response times
- **Familiarity**: Team has more experience with OpenAI SDK

**Future Consideration**: Add Claude as fallback provider for redundancy.

---

## Future Tech Additions (Roadmap)

### Phase 3 (Q1-Q2 2025)
- **Redis**: Caching layer (reduce database queries, cache AI responses)
- **CDN**: Cloudflare R2 or AWS CloudFront (faster global image delivery)
- **BullMQ**: Background job queue (long-running tasks, retries)
- **Elasticsearch**: Advanced search (cross-newsletter content discovery)

### Phase 4 (Q3-Q4 2025)
- **GPU Infrastructure**: Fine-tuned model hosting (AWS SageMaker or Replicate)
- **Apache Kafka**: Event streaming (real-time analytics, cross-newsletter insights)
- **MLflow**: Model versioning and A/B testing for AI prompts
- **LaunchDarkly**: Feature flags (gradual rollouts, A/B tests)

### Phase 5 (2026+)
- **Kubernetes**: Multi-tenant scaling (100+ newsletters)
- **Snowflake or BigQuery**: Data warehouse (business intelligence)
- **Dedicated Security**: SOC 2 audit, penetration testing
- **Multi-Region**: Deploy to 5+ global regions (sub-50ms latency worldwide)

---

## Evaluation Criteria for New Tech

Before adding any new technology, we evaluate:

1. **Value vs. Complexity**: Does it significantly improve product?
2. **Team Expertise**: Do we have skills to implement and maintain?
3. **Cost**: Balance performance gains against monthly expenses
4. **Vendor Lock-In**: Prefer open-source or easily replaceable solutions
5. **Community**: Active community for support and troubleshooting
6. **Scalability**: Will it scale to 100+ newsletters and 1M+ subscribers?
