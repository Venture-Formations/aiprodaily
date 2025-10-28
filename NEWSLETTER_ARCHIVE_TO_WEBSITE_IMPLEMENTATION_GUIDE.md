# Newsletter Archive to Website - Implementation Guide

**For:** St Cloud Scoop Newsletter (and other multi-tenant newsletter projects)
**From:** AI Pros Newsletter Platform
**Last Updated:** 2025-10-24

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Database Schema](#database-schema)
5. [Implementation Steps](#implementation-steps)
6. [Code Components](#code-components)
7. [Customization Guide](#customization-guide)
8. [Testing Checklist](#testing-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Feature Does

Automatically archives sent newsletters to a public-facing website with:
- **Archive List Page:** Grid view of all past newsletters (`/newsletters`)
- **Individual Newsletter Pages:** Full content view at `/newsletter/[date]`
- **Automatic Archiving:** Newsletters archived when sent to subscribers
- **SEO Benefits:** Public content indexed by search engines
- **Sample Content:** Lets potential subscribers preview before signing up

### Key Benefits

✅ **SEO & Discovery:** Archived newsletters create evergreen content
✅ **Social Proof:** Shows consistent publishing history
✅ **Lead Generation:** Preview content drives subscriptions
✅ **Multi-Tenant Ready:** Works with newsletter_id isolation
✅ **Content Reuse:** Newsletter content becomes website content

---

## How It Works

### User Journey

```
1. Newsletter Sent (via MailerLite/ESP)
   ↓
2. Archive Created in Database (automatic)
   ↓
3. Visitor Goes to /newsletters
   ↓
4. Sees Grid of Past Newsletters (with images, dates, metadata)
   ↓
5. Clicks Newsletter → /newsletter/2025-10-24
   ↓
6. Reads Full Content (articles, sections, CTAs)
   ↓
7. Subscribes or Views More Newsletters
```

### When Archiving Happens

**Trigger:** When newsletter is sent to subscribers (final send)

**Location:** `app/api/campaigns/[id]/send-final/route.ts` (or equivalent send endpoint)

**Process:**
1. Campaign marked as `sent`
2. `newsletterArchiver.archiveNewsletter()` called
3. Structured data saved to `archived_newsletters` table
4. Newsletter immediately available at `/newsletter/[date]`

---

## Architecture & Data Flow

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Newsletter Campaign                      │
│  (draft → processing → in_review → approved → sent)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ When sent
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                 newsletterArchiver.archiveNewsletter()       │
│  • Fetches campaign data                                     │
│  • Fetches articles (primary + secondary)                    │
│  • Fetches sections (AI apps, prompts, polls, etc.)          │
│  • Saves to archived_newsletters table                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Database: archived_newsletters                  │
│  • Structured JSON data (articles, sections, metadata)       │
│  • Indexed by campaign_date (YYYY-MM-DD)                     │
│  • Multi-tenant isolated (newsletter_id)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    Public Website Routes                     │
│                                                               │
│  /newsletters                   /newsletter/[date]           │
│  • Grid of all newsletters      • Full newsletter content    │
│  • Pagination (6 per page)      • Articles + sections        │
│  • Metadata badges               • Subscribe CTAs            │
│  • Responsive cards              • Dynamic sections          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```typescript
// 1. Newsletter sent (trigger point)
POST /api/campaigns/[id]/send-final
  ↓
// 2. Archive newsletter (during send process)
newsletterArchiver.archiveNewsletter({
  campaignId: campaign.id,
  campaignDate: campaign.date,      // "2025-10-24"
  subjectLine: campaign.subject_line,
  recipientCount: 1500
})
  ↓
// 3. Data saved to database
INSERT INTO archived_newsletters (
  campaign_id, newsletter_id, campaign_date,
  subject_line, articles, sections, metadata
)
  ↓
// 4. Immediately available on website
GET /newsletters → Shows in archive list
GET /newsletter/2025-10-24 → Shows full content
```

---

## Database Schema

### Table: `archived_newsletters`

```sql
CREATE TABLE archived_newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id),
  newsletter_id VARCHAR(50) NOT NULL,  -- Multi-tenant isolation
  campaign_date DATE NOT NULL,         -- URL-friendly (YYYY-MM-DD)
  subject_line TEXT NOT NULL,
  send_date TIMESTAMP NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  html_backup TEXT,                    -- Optional: raw HTML backup

  -- Structured data (JSONB for performance)
  metadata JSONB DEFAULT '{}'::jsonb,  -- Campaign stats/settings
  articles JSONB DEFAULT '[]'::jsonb,  -- Primary articles array
  secondary_articles JSONB DEFAULT '[]'::jsonb,
  events JSONB DEFAULT '[]'::jsonb,    -- For event newsletters
  sections JSONB DEFAULT '{}'::jsonb,  -- All sections (AI apps, polls, etc.)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  UNIQUE(campaign_id),
  UNIQUE(newsletter_id, campaign_date)
);

-- Performance indexes
CREATE INDEX idx_archived_newsletters_date
  ON archived_newsletters(campaign_date DESC);

CREATE INDEX idx_archived_newsletters_newsletter_id
  ON archived_newsletters(newsletter_id);
```

### TypeScript Interface

```typescript
export interface ArchivedNewsletter {
  id: string
  campaign_id: string
  newsletter_id: string
  campaign_date: string  // YYYY-MM-DD format for URL
  subject_line: string
  send_date: string       // ISO timestamp when sent
  recipient_count: number
  html_backup: string | null

  // Structured data
  metadata: {
    total_articles?: number
    total_secondary_articles?: number
    has_welcome?: boolean
    has_road_work?: boolean
    has_ai_apps?: boolean
    has_poll?: boolean
    has_prompt?: boolean
    archived_at?: string
    // Add any other campaign metadata
  }

  articles: Array<{
    id: string
    headline: string
    content: string
    word_count?: number
    rank?: number
    final_position?: number
    rss_post?: {
      title?: string
      source_url?: string
      image_url?: string
      publication_date?: string
    }
  }>

  secondary_articles?: Array<{
    // Same structure as articles
  }>

  events: Array<{
    // For event newsletters (St Cloud Scoop specific)
    id: string
    title: string
    description: string
    date: string
    location?: string
    url?: string
  }>

  sections: {
    welcome?: {
      intro: string
      tagline?: string
      summary?: string
    }
    road_work?: {
      items: Array<{
        title: string
        description: string
        location?: string
      }>
      generated_at: string
    }
    ai_apps?: Array<{
      app: {
        id: string
        app_name: string
        tagline?: string
        description: string
        app_url: string
        logo_url?: string
        category?: string
      }
      selection_order: number
      is_featured: boolean
    }>
    poll?: {
      question: string
      options?: string[]
    }
    prompt?: {
      id: string
      title: string
      prompt_text: string
      category?: string
    }
    // St Cloud Scoop specific sections can go here
  }

  created_at: string
  updated_at: string
}
```

---

## Implementation Steps

### Step 1: Create Database Table

**File:** Create migration in `migrations/` or `supabase/migrations/`

```sql
-- migrations/create_archived_newsletters.sql
CREATE TABLE IF NOT EXISTS archived_newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id),
  newsletter_id VARCHAR(50) NOT NULL,
  campaign_date DATE NOT NULL,
  subject_line TEXT NOT NULL,
  send_date TIMESTAMP NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  html_backup TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  articles JSONB DEFAULT '[]'::jsonb,
  secondary_articles JSONB DEFAULT '[]'::jsonb,
  events JSONB DEFAULT '[]'::jsonb,
  sections JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id),
  UNIQUE(newsletter_id, campaign_date)
);

CREATE INDEX idx_archived_newsletters_date
  ON archived_newsletters(campaign_date DESC);

CREATE INDEX idx_archived_newsletters_newsletter_id
  ON archived_newsletters(newsletter_id);

-- Add trigger for updated_at
CREATE TRIGGER update_archived_newsletters_updated_at
  BEFORE UPDATE ON archived_newsletters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Run migration:**
```bash
# If using Supabase
npx supabase migration up

# Or apply directly to database
psql $DATABASE_URL -f migrations/create_archived_newsletters.sql
```

---

### Step 2: Create Archive Service

**File:** `src/lib/newsletter-archiver.ts`

```typescript
import { supabaseAdmin } from './supabase'
import type { ArchivedNewsletter } from '@/types/database'

interface ArchiveNewsletterParams {
  campaignId: string
  campaignDate: string  // YYYY-MM-DD format
  subjectLine: string
  recipientCount: number
  htmlContent?: string  // Optional HTML backup
}

export class NewsletterArchiver {
  /**
   * Archive a newsletter at send time
   * Captures all structured data for web rendering
   */
  async archiveNewsletter(params: ArchiveNewsletterParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { campaignId, campaignDate, subjectLine, recipientCount, htmlContent } = params

      console.log(`[ARCHIVE] Archiving newsletter for campaign ${campaignId} (${campaignDate})...`)

      // 1. Fetch campaign data (including newsletter_id)
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('newsletter_id, welcome_intro, welcome_tagline, welcome_summary')
        .eq('id', campaignId)
        .single()

      if (campaignError) {
        console.error('[ARCHIVE] Error fetching campaign:', campaignError)
        return { success: false, error: `Failed to fetch campaign: ${campaignError.message}` }
      }

      // 2. Fetch all articles for this campaign
      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select(`
          id,
          headline,
          content,
          word_count,
          rank,
          final_position,
          created_at,
          rss_post:rss_posts(
            title,
            source_url,
            image_url,
            publication_date
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      if (articlesError) {
        console.error('[ARCHIVE] Error fetching articles:', articlesError)
        return { success: false, error: `Failed to fetch articles: ${articlesError.message}` }
      }

      // 3. Fetch secondary articles (if applicable)
      const { data: secondaryArticles } = await supabaseAdmin
        .from('secondary_articles')
        .select(`
          id,
          headline,
          content,
          word_count,
          rank,
          final_position,
          created_at,
          rss_post:rss_posts(
            title,
            source_url,
            image_url,
            publication_date
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('rank', { ascending: true })

      // 4. Fetch events (St Cloud Scoop specific)
      const { data: events } = await supabaseAdmin
        .from('newsletter_events')  // Your events table name
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('event_date', { ascending: true })

      // 5. Fetch additional sections data
      const sections: Record<string, any> = {}

      // Welcome section
      if (campaign && (campaign.welcome_intro || campaign.welcome_tagline || campaign.welcome_summary)) {
        sections.welcome = {
          intro: campaign.welcome_intro || '',
          tagline: campaign.welcome_tagline || '',
          summary: campaign.welcome_summary || ''
        }
      }

      // Road Work section (St Cloud Scoop specific)
      const { data: roadWork } = await supabaseAdmin
        .from('road_work_data')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .single()

      if (roadWork) {
        sections.road_work = {
          items: roadWork.road_work_data,
          generated_at: roadWork.generated_at
        }
      }

      // AI Apps section (if using)
      const { data: aiApps } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select(`
          selection_order,
          is_featured,
          app:ai_applications(
            id,
            app_name,
            tagline,
            description,
            app_url,
            logo_url,
            category,
            tool_type
          )
        `)
        .eq('campaign_id', campaignId)
        .order('selection_order', { ascending: true })

      if (aiApps && aiApps.length > 0) {
        sections.ai_apps = aiApps
      }

      // Poll section
      const { data: poll } = await supabaseAdmin
        .from('poll_questions')
        .select('*')
        .eq('campaign_id', campaignId)
        .single()

      if (poll) {
        sections.poll = poll
      }

      // 6. Gather metadata
      const metadata = {
        total_articles: articles?.length || 0,
        total_secondary_articles: secondaryArticles?.length || 0,
        total_events: events?.length || 0,
        has_welcome: !!(campaign?.welcome_intro || campaign?.welcome_tagline || campaign?.welcome_summary),
        has_road_work: !!roadWork,
        has_ai_apps: !!aiApps && aiApps.length > 0,
        has_poll: !!poll,
        archived_at: new Date().toISOString()
      }

      // 7. Create archive record
      const archiveData: Partial<ArchivedNewsletter> = {
        campaign_id: campaignId,
        newsletter_id: campaign.newsletter_id,
        campaign_date: campaignDate,
        subject_line: subjectLine,
        send_date: new Date().toISOString(),
        recipient_count: recipientCount,
        html_backup: htmlContent || null,
        metadata,
        articles: articles || [],
        secondary_articles: secondaryArticles || [],
        events: events || [],
        sections
      }

      const { error: insertError } = await supabaseAdmin
        .from('archived_newsletters')
        .insert(archiveData)

      if (insertError) {
        console.error('[ARCHIVE] Error inserting archive:', insertError)
        return { success: false, error: `Failed to create archive: ${insertError.message}` }
      }

      console.log(`[ARCHIVE] ✓ Newsletter archived successfully: ${campaignDate}`)
      return { success: true }

    } catch (error: any) {
      console.error('[ARCHIVE] Error archiving newsletter:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get archived newsletter by date
   */
  async getArchivedNewsletter(date: string): Promise<ArchivedNewsletter | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('archived_newsletters')
        .select('*')
        .eq('campaign_date', date)
        .single()

      if (error) {
        console.error('[ARCHIVE] Error fetching archived newsletter:', error)
        return null
      }

      return data as ArchivedNewsletter
    } catch (error) {
      console.error('[ARCHIVE] Error getting archived newsletter:', error)
      return null
    }
  }

  /**
   * Get list of all archived newsletters
   */
  async getArchiveList(limit = 50): Promise<Array<Pick<ArchivedNewsletter, 'id' | 'campaign_date' | 'subject_line' | 'send_date' | 'metadata'>>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('archived_newsletters')
        .select('id, campaign_date, subject_line, send_date, metadata')
        .order('campaign_date', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[ARCHIVE] Error fetching archive list:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('[ARCHIVE] Error getting archive list:', error)
      return []
    }
  }

  /**
   * Update archive with additional data (e.g., analytics)
   */
  async updateArchive(campaignId: string, updates: Partial<ArchivedNewsletter>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('archived_newsletters')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)

      if (error) {
        console.error('[ARCHIVE] Error updating archive:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('[ARCHIVE] Error updating archive:', error)
      return { success: false, error: error.message }
    }
  }
}

// Export singleton instance
export const newsletterArchiver = new NewsletterArchiver()
```

---

### Step 3: Integrate Archiving with Send Process

**File:** `src/app/api/campaigns/[id]/send-final/route.ts` (or your send endpoint)

```typescript
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // ... your existing send logic ...

    // After successful send to MailerLite/ESP
    const result = await mailerLiteService.sendCampaign(campaign)

    // Archive the newsletter for website display
    try {
      const archiveResult = await newsletterArchiver.archiveNewsletter({
        campaignId: campaign.id,
        campaignDate: campaign.date,              // "2025-10-24"
        subjectLine: campaign.subject_line || 'Newsletter',
        recipientCount: result.recipientCount || 0,
        htmlContent: result.htmlContent           // Optional
      })

      if (!archiveResult.success) {
        console.error('[SEND] Failed to archive newsletter:', archiveResult.error)
        // Don't fail the send if archiving fails - log and continue
      } else {
        console.log('[SEND] ✓ Newsletter archived successfully for', campaign.date)
      }
    } catch (archiveError) {
      console.error('[SEND] Error archiving newsletter:', archiveError)
      // Don't fail the send if archiving fails
    }

    // Update campaign status
    await supabaseAdmin
      .from('newsletter_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', campaign.id)

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error('[SEND] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

### Step 4: Create Archive List Page

**File:** `src/app/website/newsletters/page.tsx`

```typescript
import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { NewslettersList } from "@/components/website/newsletters-list"
import { supabaseAdmin } from "@/lib/supabase"

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Newsletter Archive - St Cloud Scoop',
  description: 'Browse past editions of the St Cloud Scoop newsletter'
}

export default async function NewslettersPage() {
  // Fetch settings from database
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['website_header_url', 'logo_url', 'newsletter_name', 'business_name', 'primary_color'])

  const headerImageUrl = settings?.find(s => s.key === 'website_header_url')?.value || '/logo.png'
  const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
  const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'St Cloud Scoop'
  const businessName = settings?.find(s => s.key === 'business_name')?.value || 'St Cloud Scoop'
  const primaryColor = settings?.find(s => s.key === 'primary_color')?.value || '#1c293d'
  const currentYear = new Date().getFullYear()

  // Fetch newsletters with articles data for images
  const { data: newsletters } = await supabaseAdmin
    .from('archived_newsletters')
    .select('id, campaign_date, subject_line, send_date, metadata, articles, events')
    .order('campaign_date', { ascending: false })

  return (
    <main className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Primary Color Banner */}
      <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Newsletter Archive
            </h1>
            <p className="text-base text-white/80 max-w-xl mx-auto leading-relaxed">
              Browse our complete archive of St Cloud Scoop newsletters.
            </p>
          </div>
        </div>
      </section>

      {/* Newsletters Content */}
      <NewslettersList newsletters={newsletters || []} />

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
```

---

### Step 5: Create Newsletter List Component

**File:** `src/components/website/newsletters-list.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Card } from "@/components/website/ui/card"
import { Button } from "@/components/website/ui/button"
import { Calendar, ChevronLeft, ChevronRight, Mail } from "lucide-react"
import Link from 'next/link'

const NEWSLETTERS_PER_PAGE = 6

interface Newsletter {
  id: string
  campaign_date: string
  subject_line: string
  send_date: string
  metadata?: {
    total_articles?: number
    total_secondary_articles?: number
    total_events?: number
    has_road_work?: boolean
    has_ai_apps?: boolean
    has_poll?: boolean
  }
  articles?: Array<{
    id: string
    headline: string
    rss_post?: {
      image_url?: string
      title?: string
    }
  }>
  events?: Array<{
    image_url?: string
  }>
}

interface NewslettersListProps {
  newsletters: Newsletter[]
}

export function NewslettersList({ newsletters }: NewslettersListProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Calculate pagination
  const totalPages = Math.ceil(newsletters.length / NEWSLETTERS_PER_PAGE)
  const startIndex = (currentPage - 1) * NEWSLETTERS_PER_PAGE
  const endIndex = startIndex + NEWSLETTERS_PER_PAGE
  const currentNewsletters = newsletters.slice(startIndex, endIndex)

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: number[] = []
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
    return pages
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (newsletters.length === 0) {
    return (
      <section id="newsletters" className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-[#1D1D1F]/40 mb-4" />
            <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              No Newsletters Archived Yet
            </h3>
            <p className="text-[#1D1D1F]/60 mb-6">
              Past newsletter editions will appear here once they are sent.
            </p>
            <Link href="/">
              <Button className="bg-[#1c293d] hover:bg-[#1c293d]/90 text-white">
                Go to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="newsletters" className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        {/* Newsletter Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentNewsletters.map((newsletter) => {
            const metadata = newsletter.metadata || {}
            const totalArticles = (metadata.total_articles || 0) + (metadata.total_secondary_articles || 0)
            const totalEvents = metadata.total_events || 0

            // Get first article's image or first event's image
            const firstArticle = newsletter.articles?.[0]
            const firstEvent = newsletter.events?.[0]
            const imageUrl = firstArticle?.rss_post?.image_url || firstEvent?.image_url
            const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3ESt Cloud Scoop%3C/text%3E%3C/svg%3E'

            return (
              <Link key={newsletter.id} href={`/newsletter/${newsletter.campaign_date}`}>
                <Card className="group cursor-pointer hover:shadow-lg transition-shadow overflow-hidden p-0 bg-white border-border h-full flex flex-col">
                  {/* Image */}
                  <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                    <img
                      src={imageUrl || placeholderSvg}
                      alt={firstArticle?.headline || newsletter.subject_line}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = placeholderSvg
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="px-4 pt-4 pb-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-[#1D1D1F]/60 mb-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(newsletter.send_date)}</span>
                    </div>

                    <h3 className="text-base font-bold text-[#1D1D1F] mb-2 group-hover:text-[#a855f7] transition-colors leading-tight flex-1">
                      {newsletter.subject_line}
                    </h3>

                    {/* Content Stats */}
                    <div className="flex items-center gap-3 text-xs text-[#1D1D1F]/70 flex-wrap">
                      {totalArticles > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {totalArticles} {totalArticles === 1 ? 'article' : 'articles'}
                        </span>
                      )}
                      {totalEvents > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
                        </span>
                      )}
                      {metadata.has_road_work && (
                        <span className="flex items-center gap-1">
                          🚧 Road Work
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              First
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {getPageNumbers().map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className={`w-10 h-10 rounded-lg ${
                    currentPage === page
                      ? "bg-[#1c293d] text-white hover:bg-[#1c293d]/90"
                      : "text-[#1D1D1F] hover:bg-white/50"
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
```

---

### Step 6: Create Individual Newsletter Page

**File:** `src/app/website/newsletter/[date]/page.tsx`

```typescript
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import type { ArchivedNewsletter } from '@/types/database'
import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { supabaseAdmin } from "@/lib/supabase"

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date)

  if (!newsletter) {
    return {
      title: 'Newsletter Not Found'
    }
  }

  return {
    title: `${newsletter.subject_line} - St Cloud Scoop`,
    description: `St Cloud Scoop newsletter from ${new Date(newsletter.campaign_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    openGraph: {
      title: newsletter.subject_line,
      description: `St Cloud Scoop newsletter from ${new Date(newsletter.campaign_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      type: 'article',
      publishedTime: newsletter.send_date,
    }
  }
}

export default async function NewsletterPage({ params }: PageProps) {
  const { date } = await params
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date)

  if (!newsletter) {
    notFound()
  }

  // Fetch settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['website_header_url', 'logo_url', 'newsletter_name', 'business_name'])

  const headerImageUrl = settings?.find(s => s.key === 'website_header_url')?.value || '/logo.png'
  const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
  const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'St Cloud Scoop'
  const businessName = settings?.find(s => s.key === 'business_name')?.value || 'St Cloud Scoop'
  const currentYear = new Date().getFullYear()

  const formattedDate = new Date(newsletter.campaign_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const articles = newsletter.articles || []
  const events = newsletter.events || []
  const roadWork = newsletter.sections?.road_work
  const welcome = newsletter.sections?.welcome

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Content */}
      <section className="pt-20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Link
            href="/newsletters"
            className="text-sm text-[#a855f7] hover:text-[#a855f7]/80 mb-4 inline-block"
          >
            ← Back to Newsletter Archive
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] mb-2">
              {newsletter.subject_line}
            </h1>
            <p className="text-[#1D1D1F]/60">{formattedDate}</p>
          </div>

          {/* Welcome Section */}
          {welcome && (welcome.intro || welcome.tagline || welcome.summary) && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">Welcome</h2>
              <div className="space-y-3">
                {welcome.intro && (
                  <div className="text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                    {welcome.intro}
                  </div>
                )}
                {welcome.tagline && (
                  <div className="text-[#1D1D1F] leading-relaxed font-bold whitespace-pre-wrap">
                    {welcome.tagline}
                  </div>
                )}
                {welcome.summary && (
                  <div className="text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                    {welcome.summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Articles Section */}
          {articles.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">Top Stories</h2>
              <div className="space-y-8">
                {articles.map((article: any, index: number) => (
                  <article key={article.id} className="border-b border-gray-200 last:border-0 pb-8 last:pb-0">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#1c293d] text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] mb-3">
                          {article.headline}
                        </h3>

                        <div className="text-[#1D1D1F]/80 leading-relaxed mb-4 whitespace-pre-wrap">
                          {article.content}
                        </div>

                        {article.rss_post?.source_url && (
                          <a
                            href={article.rss_post.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#a855f7] hover:text-[#a855f7]/80 text-sm font-medium inline-flex items-center gap-1"
                          >
                            Read full story
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Events Section (St Cloud Scoop specific) */}
          {events.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">Upcoming Events</h2>
              <div className="space-y-6">
                {events.map((event: any, index: number) => (
                  <div key={event.id || index} className="border-b border-gray-200 last:border-0 pb-6 last:pb-0">
                    <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">
                      {event.title}
                    </h3>
                    {event.date && (
                      <p className="text-sm text-[#1D1D1F]/60 mb-2">
                        📅 {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-sm text-[#1D1D1F]/60 mb-2">
                        📍 {event.location}
                      </p>
                    )}
                    <p className="text-[#1D1D1F]/80 leading-relaxed mb-3">
                      {event.description}
                    </p>
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a855f7] hover:text-[#a855f7]/80 text-sm font-medium inline-flex items-center gap-1"
                      >
                        Learn more
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Road Work Section */}
          {roadWork && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">🚧 Road Work</h2>
              <div className="space-y-3">
                {roadWork.items && roadWork.items.map((item: any, index: number) => (
                  <div key={index} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                    <div className="font-bold text-[#1D1D1F]">{item.title}</div>
                    <div className="text-[#1D1D1F]/80 text-sm mt-1">{item.description}</div>
                    {item.location && (
                      <div className="text-[#1D1D1F]/60 text-xs mt-1">📍 {item.location}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="text-center py-8 border-t border-gray-200 bg-white rounded-xl px-6 mt-8">
            <p className="text-[#1D1D1F]/60 mb-4">
              This is an archived edition of the St Cloud Scoop newsletter.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/newsletters"
                className="text-[#a855f7] hover:text-[#a855f7]/80 font-medium"
              >
                View All Newsletters
              </Link>
              <span className="text-[#1D1D1F]/40">|</span>
              <Link
                href="/"
                className="text-[#a855f7] hover:text-[#a855f7]/80 font-medium"
              >
                Subscribe Today
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </div>
  )
}
```

---

## Code Components

### Key Files Structure

```
src/
├── lib/
│   └── newsletter-archiver.ts          # Archive service (Step 2)
├── types/
│   └── database.ts                     # ArchivedNewsletter interface
├── app/
│   ├── api/
│   │   ├── campaigns/
│   │   │   └── [id]/
│   │   │       └── send-final/
│   │   │           └── route.ts        # Integration point (Step 3)
│   │   └── newsletters/
│   │       └── archived/
│   │           └── route.ts            # API endpoint (optional)
│   └── website/
│       ├── newsletters/
│       │   └── page.tsx                # Archive list (Step 4)
│       └── newsletter/
│           └── [date]/
│               └── page.tsx            # Individual newsletter (Step 6)
└── components/
    └── website/
        └── newsletters-list.tsx        # List component (Step 5)
```

---

## Customization Guide

### For St Cloud Scoop Newsletter

#### 1. **Events Section (Priority)**

St Cloud Scoop is event-focused. Update archiver to fetch events:

```typescript
// In newsletter-archiver.ts
const { data: events } = await supabaseAdmin
  .from('newsletter_events')  // Your events table
  .select(`
    id,
    title,
    description,
    event_date,
    event_time,
    location,
    venue_name,
    url,
    image_url,
    category
  `)
  .eq('campaign_id', campaignId)
  .eq('is_active', true)
  .order('event_date', { ascending: true })

// Add to sections
if (events && events.length > 0) {
  archiveData.events = events
}
```

#### 2. **Road Work Section**

Keep or remove based on your needs:

```typescript
// Keep if St Cloud Scoop has road work data
const { data: roadWork } = await supabaseAdmin
  .from('road_work_data')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('is_active', true)

if (roadWork) {
  sections.road_work = {
    items: roadWork.road_work_data,
    generated_at: roadWork.generated_at
  }
}
```

#### 3. **Branding & Colors**

Update colors in components:

```typescript
// Change primary color
const primaryColor = '#yourBrandColor'  // e.g., '#e63946'

// Update in CSS classes
className="bg-[#yourColor] text-white"
className="text-[#yourColor] hover:text-[#yourColor]/80"
```

#### 4. **Metadata Badges**

Customize badges in `newsletters-list.tsx`:

```typescript
<div className="flex items-center gap-3 text-xs text-[#1D1D1F]/70 flex-wrap">
  {totalArticles > 0 && (
    <span className="flex items-center gap-1">
      📰 {totalArticles} articles
    </span>
  )}
  {totalEvents > 0 && (
    <span className="flex items-center gap-1">
      📅 {totalEvents} events
    </span>
  )}
  {metadata.has_road_work && (
    <span>🚧 Road Work</span>
  )}
</div>
```

#### 5. **Newsletter URL Structure**

Current: `/newsletter/2025-10-24`

If you prefer `/newsletters/2025-10-24`:

```typescript
// Change folder structure
src/app/website/newsletters/[date]/page.tsx

// Update links
href={`/newsletters/${newsletter.campaign_date}`}
```

---

## Testing Checklist

### Before Going Live

- [ ] **Database Migration**
  - [ ] `archived_newsletters` table created
  - [ ] Indexes created (campaign_date, newsletter_id)
  - [ ] Test insert with sample data

- [ ] **Archive Service**
  - [ ] `newsletterArchiver` singleton works
  - [ ] `archiveNewsletter()` saves data correctly
  - [ ] `getArchivedNewsletter()` retrieves data
  - [ ] `getArchiveList()` returns sorted list

- [ ] **Integration**
  - [ ] Send process calls archiver
  - [ ] Archiving doesn't break send (error handling)
  - [ ] Campaign marked as `sent` after archiving

- [ ] **Archive List Page**
  - [ ] `/newsletters` loads correctly
  - [ ] Pagination works (6 per page)
  - [ ] Images display (fallback for missing images)
  - [ ] Empty state shows when no newsletters
  - [ ] Responsive on mobile/tablet/desktop

- [ ] **Individual Newsletter Page**
  - [ ] `/newsletter/[date]` loads correctly
  - [ ] All sections render (articles, events, road work)
  - [ ] Links work (back to archive, external links)
  - [ ] Metadata correct (SEO, OpenGraph)
  - [ ] Responsive design

- [ ] **Multi-Tenant Isolation**
  - [ ] Only shows newsletters for correct `newsletter_id`
  - [ ] No data leakage between newsletters

- [ ] **Performance**
  - [ ] Archive list loads in < 2 seconds
  - [ ] Individual newsletters load in < 1 second
  - [ ] Images optimized/lazy loaded

### Test Cases

#### Test 1: Archive a Newsletter
```bash
# Send a test campaign
curl -X POST https://your-domain.com/api/campaigns/[id]/send-final \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check database
psql $DATABASE_URL -c "SELECT * FROM archived_newsletters ORDER BY created_at DESC LIMIT 1;"

# Visit archive page
open https://your-domain.com/newsletters
```

#### Test 2: View Archived Newsletter
```bash
# Visit specific newsletter
open https://your-domain.com/newsletter/2025-10-24

# Verify:
# - Subject line displays
# - Articles render with content
# - Events display (if applicable)
# - Images load correctly
# - Links work
```

#### Test 3: Pagination
```bash
# Create 10+ archived newsletters
# Visit /newsletters
# Click through pagination: 1, 2, Next, Last, Back, First
# Verify page numbers update correctly
```

#### Test 4: Empty State
```bash
# Clear archived_newsletters table
psql $DATABASE_URL -c "DELETE FROM archived_newsletters;"

# Visit /newsletters
# Verify empty state shows: "No Newsletters Archived Yet"
```

#### Test 5: Multi-Tenant Isolation
```bash
# Archive newsletters for different newsletter_ids
# Verify each newsletter only shows its own archives
# Check URL params don't leak data across tenants
```

---

## Troubleshooting

### Issue: Newsletter not archiving

**Symptoms:** Send succeeds, but no archive created

**Diagnosis:**
```typescript
// Check logs
console.log('[SEND] Archive result:', archiveResult)

// Check database
SELECT * FROM archived_newsletters WHERE campaign_id = 'YOUR_CAMPAIGN_ID';
```

**Solutions:**
1. Verify `newsletterArchiver.archiveNewsletter()` is called
2. Check error logs in Vercel/console
3. Ensure `newsletter_id` exists on campaign
4. Verify database permissions (RLS policies)

---

### Issue: Archive list page shows no newsletters

**Symptoms:** `/newsletters` shows empty state despite archived data

**Diagnosis:**
```typescript
// Check database directly
SELECT id, campaign_date, subject_line FROM archived_newsletters;

// Check query in component
const { data, error } = await supabaseAdmin
  .from('archived_newsletters')
  .select('*')

console.log('Data:', data, 'Error:', error)
```

**Solutions:**
1. Verify `archived_newsletters` table exists
2. Check RLS policies allow public read
3. Ensure `newsletter_id` filter matches (if multi-tenant)
4. Check `dynamic = 'force-dynamic'` in page.tsx

---

### Issue: Individual newsletter 404s

**Symptoms:** `/newsletter/2025-10-24` returns Not Found

**Diagnosis:**
```typescript
// Check date format
const newsletter = await newsletterArchiver.getArchivedNewsletter('2025-10-24')
console.log('Newsletter:', newsletter)

// Check database
SELECT * FROM archived_newsletters WHERE campaign_date = '2025-10-24';
```

**Solutions:**
1. Verify date format is YYYY-MM-DD (not YYYY/MM/DD)
2. Check campaign_date saved correctly
3. Ensure `notFound()` isn't triggered incorrectly
4. Check URL matches database date exactly

---

### Issue: Images not loading

**Symptoms:** Placeholder shows instead of images

**Diagnosis:**
```typescript
// Check image URLs in database
SELECT
  id,
  subject_line,
  articles->0->'rss_post'->'image_url' as first_image
FROM archived_newsletters;
```

**Solutions:**
1. Verify `rss_posts` table has `image_url` populated
2. Check CORS settings if images from external domains
3. Add `onError` handler to fallback to placeholder
4. Optimize images (use Next.js Image component if needed)

---

### Issue: Pagination not working

**Symptoms:** Page numbers don't change content

**Diagnosis:**
```typescript
// Check state management
const [currentPage, setCurrentPage] = useState(1)
console.log('Current page:', currentPage, 'Total pages:', totalPages)
```

**Solutions:**
1. Ensure component is `'use client'`
2. Verify `setCurrentPage` is called on button click
3. Check `totalPages` calculation: `Math.ceil(newsletters.length / 6)`
4. Verify `slice()` logic uses correct indices

---

### Issue: Sections not rendering

**Symptoms:** Events, road work, or other sections don't show

**Diagnosis:**
```typescript
// Check sections data
const newsletter = await newsletterArchiver.getArchivedNewsletter(date)
console.log('Sections:', newsletter.sections)
console.log('Events:', newsletter.events)
```

**Solutions:**
1. Verify archiver fetches section data
2. Check conditional rendering logic: `{events.length > 0 && ...}`
3. Ensure section data structure matches component expectations
4. Check database foreign keys and joins

---

## Additional Resources

### Related Documentation

- **AI Pros Newsletter:** `FEATURE_PUBLIC_NEWSLETTER_ARCHIVE.md`
- **Database Schema:** `database_complete_schema.sql`
- **Multi-Tenant Guide:** Check your project's multi-tenant documentation
- **Newsletter Sections:** Your project's section management docs

### Next Steps After Implementation

1. **Add Analytics:** Track newsletter views, click-through rates
2. **Add Search:** Allow searching archived newsletters by keyword
3. **Add Filters:** Filter by date range, category, tags
4. **Add RSS Feed:** Generate RSS feed from archived newsletters
5. **Add Social Sharing:** Share buttons for LinkedIn, Twitter, email
6. **Add PDF Export:** Download newsletter as PDF
7. **Add Related Newsletters:** Suggest similar past editions
8. **Add Comments:** Allow comments on archived newsletters

---

## Summary

This guide provides everything needed to implement newsletter-to-website archiving:

1. ✅ Database schema (`archived_newsletters` table)
2. ✅ Archive service (`newsletterArchiver`)
3. ✅ Integration with send process
4. ✅ Archive list page (`/newsletters`)
5. ✅ Individual newsletter pages (`/newsletter/[date]`)
6. ✅ Customization for St Cloud Scoop (events, road work)
7. ✅ Testing checklist
8. ✅ Troubleshooting guide

**Time Estimate:** 4-6 hours for full implementation and testing

**Key Benefits:**
- Automatic archiving on send
- SEO-friendly public content
- Lead generation through previews
- Reusable content library
- Multi-tenant ready

**Questions?** Review the source files in AI Pros Newsletter or ask for clarification on specific sections.

---

**Document Version:** 1.0
**Created:** 2025-10-24
**Source Project:** AI Pros Newsletter Platform
**Target Project:** St Cloud Scoop Newsletter
