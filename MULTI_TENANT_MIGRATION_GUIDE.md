# Multi-Tenant Newsletter Platform Migration Guide

**Created:** 2025-10-13
**Target Architecture:** Subdomain-based multi-tenant system with single admin account
**Current Project:** St. Cloud Scoop (remains independent)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Step-by-Step Migration Process](#step-by-step-migration-process)
4. [Database Schema Design](#database-schema-design)
5. [Code Modifications Required](#code-modifications-required)
6. [Deployment Configuration](#deployment-configuration)
7. [Testing Checklist](#testing-checklist)
8. [Subdomain Setup Guide](#subdomain-setup-guide)

---

## 🎯 Overview

### What We're Building

A **multi-tenant newsletter management platform** where:
- **Admin Dashboard** (`admin.yourdomain.com`) - Select and manage newsletters
- **Newsletter Dashboards** (`newsletter-slug.yourdomain.com`) - Individual newsletter management
- **Shared Infrastructure** - Single Supabase database and Vercel project
- **Highly Customizable** - Each newsletter can have completely different sections, AI prompts, RSS feeds

### What Stays Separate

- **Current St. Cloud Scoop** remains completely independent
- **No migration** of existing data required
- **New codebase** copied from St. Cloud Scoop as a base

---

## 🏗️ Architecture Decisions

Based on your selections:

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Authentication** | Single Admin Account | Simplest setup, one login for all newsletters |
| **Customization** | Highly Customizable | Each newsletter can have different sections/prompts/feeds |
| **Database** | Hybrid (Shared config + Separate content) | Balance of isolation and simplicity |
| **Routing** | Subdomain-Based | Professional appearance, clean separation |
| **Migration** | Keep Separate | No risk to existing St. Cloud Scoop production system |

---

## 🚀 Step-by-Step Migration Process

### Phase 1: Project Setup (30 minutes)

#### Step 1: Create New Directory

```bash
# Navigate to your projects folder
cd C:\Users\dpenn\Documents

# Create new project directory
mkdir Newsletter_Platform
cd Newsletter_Platform

# Copy current St. Cloud Scoop as base
xcopy /E /I /H C:\Users\dpenn\Documents\STC_Scoop .
```

#### Step 2: Clean Up Copied Project

```bash
# Remove existing Git history
rmdir /S /Q .git

# Remove node_modules to reinstall fresh
rmdir /S /Q node_modules

# Remove .next build folder
rmdir /S /Q .next

# Initialize new Git repository
git init
git add .
git commit -m "Initial commit - Multi-tenant newsletter platform"
```

#### Step 3: Update Package.json

```bash
# Edit package.json
# Change name from "stc-scoop" to "newsletter-platform"
```

**File: `package.json`**
```json
{
  "name": "newsletter-platform",
  "version": "0.1.0",
  "private": true,
  ...
}
```

---

### Phase 2: New Supabase Project Setup (20 minutes)

#### Step 1: Create New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Name: `Newsletter Platform` (or your preferred name)
4. Database Password: **Save this securely!**
5. Region: Choose closest to your users
6. Click **"Create new project"** (takes ~2 minutes)

#### Step 2: Get Supabase Credentials

1. Once project is ready, go to **Settings > API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (click "Reveal" to see)

#### Step 3: Update .env.local

Create new `.env.local` file in `Newsletter_Platform` directory:

```env
# Database (NEW SUPABASE PROJECT)
SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_NEW_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_NEW_SERVICE_ROLE_KEY

# AI (Reuse existing or create new)
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# Email (Create new MailerLite account or reuse)
MAILERLITE_API_KEY=YOUR_MAILERLITE_API_KEY
MAILERLITE_REVIEW_GROUP_ID=
MAILERLITE_MAIN_GROUP_ID=

# Cron Security (Generate new secret)
CRON_SECRET=YOUR_NEW_RANDOM_SECRET_32_CHARS

# NextAuth (Generate new secret)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=YOUR_NEW_NEXTAUTH_SECRET

# Vercel API (Get from Vercel dashboard)
VERCEL_API_KEY=

# Google Cloud Vision API (Optional - for image analysis)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CREDENTIALS_JSON=

# Slack Notifications (Optional)
SLACK_WEBHOOK_URL=
```

**To generate secure secrets:**
```bash
# PowerShell command to generate random secrets
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

### Phase 3: Database Schema Creation (45 minutes)

#### Step 1: Run Base Schema SQL

In your new Supabase project:
1. Go to **SQL Editor**
2. Click **"New query"**
3. Copy and paste the SQL schema provided in [Database Schema Design](#database-schema-design) section below
4. Click **"Run"**

This will create:
- All existing St. Cloud Scoop tables
- New `newsletters` table for multi-tenant support
- New `newsletter_settings` table for per-newsletter configuration
- Updated foreign key relationships with `newsletter_id`

---

### Phase 4: Code Modifications (3-4 hours)

See [Code Modifications Required](#code-modifications-required) section below for detailed changes needed.

**Summary of changes:**
1. Add `newsletter_id` context throughout application
2. Create newsletter selector dashboard
3. Add subdomain detection middleware
4. Update all database queries to filter by `newsletter_id`
5. Create newsletter-specific settings management
6. Update authentication to set active newsletter

---

### Phase 5: Vercel Deployment Setup (30 minutes)

See [Deployment Configuration](#deployment-configuration) section below.

---

### Phase 6: Subdomain Configuration (45 minutes)

See [Subdomain Setup Guide](#subdomain-setup-guide) section below.

---

### Phase 7: Testing & Launch (2 hours)

See [Testing Checklist](#testing-checklist) section below.

---

## 🗄️ Database Schema Design

### Key Concepts

**Hybrid Architecture:**
- **Shared Tables**: `newsletters`, `newsletter_settings`, `app_settings`, `users`
- **Content Tables**: All campaign/article/event tables get `newsletter_id` column

### New Tables

#### 1. Newsletters Table

```sql
-- Core newsletter registry
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'stcloud', 'detroit-news')
  name TEXT NOT NULL, -- Display name (e.g., 'St. Cloud Scoop')
  subdomain TEXT UNIQUE NOT NULL, -- Subdomain (e.g., 'stcloud' for stcloud.yourdomain.com)
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6', -- Hex color for branding
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example data
INSERT INTO newsletters (slug, name, subdomain, description) VALUES
('stcloud', 'St. Cloud Scoop', 'stcloud', 'Daily newsletter for St. Cloud, Minnesota'),
('detroit', 'Detroit Daily', 'detroit', 'Daily newsletter for Detroit, Michigan');
```

#### 2. Newsletter Settings Table

```sql
-- Per-newsletter configuration (replaces global app_settings for multi-tenant)
CREATE TABLE newsletter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  custom_default TEXT, -- For AI prompts
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(newsletter_id, key)
);

-- Example: St. Cloud's RSS feed
INSERT INTO newsletter_settings (newsletter_id, key, value, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'stcloud'),
 'rss_feed_url',
 'https://rss.app/feeds/_flJgCqGgmZncd9Sk.xml',
 'Primary RSS feed URL');

-- Example: Detroit's RSS feed
INSERT INTO newsletter_settings (newsletter_id, key, value, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'detroit'),
 'rss_feed_url',
 'https://example.com/detroit-rss.xml',
 'Primary RSS feed URL');
```

### Modified Existing Tables

All tables that currently don't have `newsletter_id` need to be updated:

```sql
-- Add newsletter_id to campaign table
ALTER TABLE newsletter_campaigns ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_campaigns_newsletter ON newsletter_campaigns(newsletter_id);

-- Add newsletter_id to rss_feeds table
ALTER TABLE rss_feeds ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_rss_feeds_newsletter ON rss_feeds(newsletter_id);

-- Add newsletter_id to events table
ALTER TABLE events ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_events_newsletter ON events(newsletter_id);

-- Add newsletter_id to dining_deals table
ALTER TABLE dining_deals ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_dining_deals_newsletter ON dining_deals(newsletter_id);

-- Add newsletter_id to vrbo_listings table
ALTER TABLE vrbo_listings ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_vrbo_listings_newsletter ON vrbo_listings(newsletter_id);

-- Add newsletter_id to wordles table
ALTER TABLE wordles ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_wordles_newsletter ON wordles(newsletter_id);

-- Add newsletter_id to weather_forecasts table
ALTER TABLE weather_forecasts ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_weather_forecasts_newsletter ON weather_forecasts(newsletter_id);

-- Add newsletter_id to road_work_items table
ALTER TABLE road_work_items ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_road_work_items_newsletter ON road_work_items(newsletter_id);

-- Add newsletter_id to advertisements table
ALTER TABLE advertisements ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_advertisements_newsletter ON advertisements(newsletter_id);

-- Add newsletter_id to polls table
ALTER TABLE polls ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_polls_newsletter ON polls(newsletter_id);

-- Add newsletter_id to images table (optional - for newsletter-specific image libraries)
ALTER TABLE images ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE SET NULL;
CREATE INDEX idx_images_newsletter ON images(newsletter_id);

-- Add newsletter_id to newsletter_sections table
ALTER TABLE newsletter_sections ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_newsletter_sections_newsletter ON newsletter_sections(newsletter_id);
```

### Complete SQL Schema File

**File: `database_schema_multitenant.sql`**

```sql
-- ============================================
-- MULTI-TENANT NEWSLETTER PLATFORM SCHEMA
-- ============================================
-- This schema extends the St. Cloud Scoop database
-- with multi-tenant support via newsletter_id

-- ============================================
-- 1. NEWSLETTERS TABLE (NEW)
-- ============================================

CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. NEWSLETTER SETTINGS TABLE (NEW)
-- ============================================

CREATE TABLE newsletter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  custom_default TEXT,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(newsletter_id, key)
);

CREATE INDEX idx_newsletter_settings_newsletter ON newsletter_settings(newsletter_id);
CREATE INDEX idx_newsletter_settings_key ON newsletter_settings(key);

-- ============================================
-- 3. UPDATE EXISTING TABLES WITH NEWSLETTER_ID
-- ============================================

-- Campaigns
ALTER TABLE newsletter_campaigns ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_campaigns_newsletter ON newsletter_campaigns(newsletter_id);

-- RSS Feeds
ALTER TABLE rss_feeds ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_rss_feeds_newsletter ON rss_feeds(newsletter_id);

-- Events
ALTER TABLE events ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_events_newsletter ON events(newsletter_id);

-- Dining Deals
ALTER TABLE dining_deals ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_dining_deals_newsletter ON dining_deals(newsletter_id);

-- VRBO Listings
ALTER TABLE vrbo_listings ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_vrbo_listings_newsletter ON vrbo_listings(newsletter_id);

-- Wordles
ALTER TABLE wordles ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_wordles_newsletter ON wordles(newsletter_id);

-- Weather Forecasts
ALTER TABLE weather_forecasts ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_weather_forecasts_newsletter ON weather_forecasts(newsletter_id);

-- Road Work Items
ALTER TABLE road_work_items ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_road_work_items_newsletter ON road_work_items(newsletter_id);

-- Advertisements
ALTER TABLE advertisements ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_advertisements_newsletter ON advertisements(newsletter_id);

-- Polls
ALTER TABLE polls ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_polls_newsletter ON polls(newsletter_id);

-- Images (nullable - can be shared across newsletters)
ALTER TABLE images ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE SET NULL;
CREATE INDEX idx_images_newsletter ON images(newsletter_id);

-- Newsletter Sections
ALTER TABLE newsletter_sections ADD COLUMN newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE;
CREATE INDEX idx_newsletter_sections_newsletter ON newsletter_sections(newsletter_id);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Function to get newsletter by subdomain
CREATE OR REPLACE FUNCTION get_newsletter_by_subdomain(subdomain_input TEXT)
RETURNS newsletters AS $$
BEGIN
  RETURN (SELECT * FROM newsletters WHERE subdomain = subdomain_input AND is_active = true);
END;
$$ LANGUAGE plpgsql;

-- Function to get newsletter settings
CREATE OR REPLACE FUNCTION get_newsletter_setting(
  newsletter_id_input UUID,
  key_input TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT value
    FROM newsletter_settings
    WHERE newsletter_id = newsletter_id_input
    AND key = key_input
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. SAMPLE DATA (FOR TESTING)
-- ============================================

-- Insert sample newsletters
INSERT INTO newsletters (slug, name, subdomain, description) VALUES
('stcloud', 'St. Cloud Scoop', 'stcloud', 'Daily newsletter for St. Cloud, Minnesota'),
('detroit', 'Detroit Daily', 'detroit', 'Daily newsletter for Detroit, Michigan');

-- Insert sample settings for St. Cloud
INSERT INTO newsletter_settings (newsletter_id, key, value, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'stcloud'), 'rss_feed_url', 'https://rss.app/feeds/_flJgCqGgmZncd9Sk.xml', 'Primary RSS feed URL'),
((SELECT id FROM newsletters WHERE slug = 'stcloud'), 'mailerlite_review_group_id', '162626524274493402', 'MailerLite review group ID'),
((SELECT id FROM newsletters WHERE slug = 'stcloud'), 'mailerlite_main_group_id', '163807731192431717', 'MailerLite main subscriber group ID'),
((SELECT id FROM newsletters WHERE slug = 'stcloud'), 'from_email', 'scoop@stcscoop.com', 'Email sender address'),
((SELECT id FROM newsletters WHERE slug = 'stcloud'), 'sender_name', 'St. Cloud Scoop', 'Email sender name');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Update application code to include newsletter_id context
-- 2. Update all database queries to filter by newsletter_id
-- 3. Test thoroughly before deploying to production
```

---

## 💻 Code Modifications Required

### 1. Create Newsletter Context Provider

**File: `src/contexts/NewsletterContext.tsx` (NEW)**

```typescript
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Newsletter {
  id: string
  slug: string
  name: string
  subdomain: string
  description: string | null
  logo_url: string | null
  primary_color: string
  is_active: boolean
}

interface NewsletterContextType {
  newsletter: Newsletter | null
  setNewsletter: (newsletter: Newsletter | null) => void
  isLoading: boolean
}

const NewsletterContext = createContext<NewsletterContextType | undefined>(undefined)

export function NewsletterProvider({ children }: { children: React.ReactNode }) {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Extract subdomain from hostname
    const hostname = window.location.hostname
    const parts = hostname.split('.')

    // If subdomain exists and not 'admin' or 'www'
    if (parts.length > 2 && parts[0] !== 'admin' && parts[0] !== 'www') {
      const subdomain = parts[0]

      // Fetch newsletter by subdomain
      fetch(`/api/newsletters/by-subdomain?subdomain=${subdomain}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNewsletter(data.newsletter)
          }
          setIsLoading(false)
        })
        .catch(err => {
          console.error('Failed to load newsletter:', err)
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [pathname])

  return (
    <NewsletterContext.Provider value={{ newsletter, setNewsletter, isLoading }}>
      {children}
    </NewsletterContext.Provider>
  )
}

export function useNewsletter() {
  const context = useContext(NewsletterContext)
  if (context === undefined) {
    throw new Error('useNewsletter must be used within a NewsletterProvider')
  }
  return context
}
```

### 2. Create Newsletter Selector Dashboard

**File: `src/app/admin/newsletters/page.tsx` (NEW)**

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Newsletter {
  id: string
  slug: string
  name: string
  subdomain: string
  description: string | null
  logo_url: string | null
  primary_color: string
  is_active: boolean
}

export default function NewsletterSelectorPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/newsletters')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNewsletters(data.newsletters)
        }
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading newsletters...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Newsletter Platform</h1>
          <p className="text-gray-600 mt-2">Select a newsletter to manage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsletters.map((newsletter) => (
            <Link
              key={newsletter.id}
              href={`/admin/newsletters/${newsletter.slug}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200"
            >
              <div className="flex items-start space-x-4">
                {newsletter.logo_url ? (
                  <img
                    src={newsletter.logo_url}
                    alt={newsletter.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded flex items-center justify-center text-white font-bold text-2xl"
                    style={{ backgroundColor: newsletter.primary_color }}
                  >
                    {newsletter.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">{newsletter.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{newsletter.subdomain}.yourdomain.com</p>
                  {newsletter.description && (
                    <p className="text-sm text-gray-600 mt-2">{newsletter.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-blue-600 font-medium">Manage Newsletter →</span>
              </div>
            </Link>
          ))}
        </div>

        {newsletters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No newsletters found. Create your first newsletter to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 3. Create Newsletter API Endpoints

**File: `src/app/api/newsletters/route.ts` (NEW)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/newsletters - List all newsletters
export async function GET(request: NextRequest) {
  try {
    const { data: newsletters, error } = await supabaseAdmin
      .from('newsletters')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      newsletters: newsletters || []
    })
  } catch (error) {
    console.error('Failed to fetch newsletters:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}

// POST /api/newsletters - Create new newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, name, subdomain, description, logo_url, primary_color } = body

    // Validate required fields
    if (!slug || !name || !subdomain) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: slug, name, subdomain' },
        { status: 400 }
      )
    }

    // Insert newsletter
    const { data: newsletter, error } = await supabaseAdmin
      .from('newsletters')
      .insert({
        slug,
        name,
        subdomain,
        description,
        logo_url,
        primary_color: primary_color || '#3B82F6'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      newsletter
    })
  } catch (error) {
    console.error('Failed to create newsletter:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create newsletter' },
      { status: 500 }
    )
  }
}
```

**File: `src/app/api/newsletters/by-subdomain/route.ts` (NEW)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/newsletters/by-subdomain?subdomain=stcloud
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: 'Missing subdomain parameter' },
        { status: 400 }
      )
    }

    const { data: newsletter, error } = await supabaseAdmin
      .from('newsletters')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Newsletter not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      newsletter
    })
  } catch (error) {
    console.error('Failed to fetch newsletter by subdomain:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch newsletter' },
      { status: 500 }
    )
  }
}
```

### 4. Update Supabase Client to Include Newsletter ID

**File: `src/lib/newsletter-supabase.ts` (NEW)**

```typescript
import { supabaseAdmin } from './supabase'

export interface NewsletterContext {
  newsletter_id: string
  newsletter_slug: string
}

/**
 * Get Supabase client with newsletter context
 * All queries will be scoped to this newsletter
 */
export function getNewsletterClient(context: NewsletterContext) {
  return {
    ...supabaseAdmin,
    context,

    // Helper to add newsletter_id filter to queries
    from: (table: string) => {
      const query = supabaseAdmin.from(table)

      // Tables that need newsletter_id filtering
      const tenantTables = [
        'newsletter_campaigns',
        'rss_feeds',
        'events',
        'dining_deals',
        'vrbo_listings',
        'wordles',
        'weather_forecasts',
        'road_work_items',
        'advertisements',
        'polls',
        'newsletter_sections'
      ]

      if (tenantTables.includes(table)) {
        return query.eq('newsletter_id', context.newsletter_id)
      }

      return query
    }
  }
}
```

### 5. Update Middleware to Detect Subdomain

**File: `src/middleware.ts` (UPDATE or CREATE)**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Extract subdomain
  const parts = hostname.split('.')

  // Handle localhost (development)
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // Development mode - allow all routes
    return NextResponse.next()
  }

  // Production subdomain handling
  if (parts.length >= 3) {
    const subdomain = parts[0]

    // Admin subdomain
    if (subdomain === 'admin') {
      // Redirect to newsletter selector if accessing root
      if (url.pathname === '/') {
        return NextResponse.redirect(new URL('/admin/newsletters', request.url))
      }
      return NextResponse.next()
    }

    // Newsletter subdomain
    if (subdomain !== 'www') {
      // Rewrite to newsletter-specific dashboard
      // stcloud.yourdomain.com/campaigns → /newsletters/stcloud/campaigns
      const rewriteUrl = new URL(url)
      rewriteUrl.pathname = `/newsletters/${subdomain}${url.pathname}`

      return NextResponse.rewrite(rewriteUrl)
    }
  }

  // Default: allow request to proceed
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### 6. Update Campaign Routes to Use Newsletter ID

**Example: File `src/app/api/campaigns/route.ts`**

```typescript
// BEFORE (St. Cloud Scoop - no newsletter_id)
const { data: campaigns, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('*')
  .order('date', { ascending: false })

// AFTER (Multi-tenant - with newsletter_id)
const newsletter_id = request.headers.get('x-newsletter-id')

if (!newsletter_id) {
  return NextResponse.json(
    { error: 'Missing newsletter context' },
    { status: 400 }
  )
}

const { data: campaigns, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('*')
  .eq('newsletter_id', newsletter_id)
  .order('date', { ascending: false })
```

**Pattern to apply to ALL API routes:**

1. Extract `newsletter_id` from request headers or query params
2. Validate `newsletter_id` exists
3. Add `.eq('newsletter_id', newsletter_id)` to all queries
4. When creating new records, include `newsletter_id` in insert data

---

## 🚀 Deployment Configuration

### Vercel Setup

#### Step 1: Create New Vercel Project

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Navigate to project directory
cd C:\Users\dpenn\Documents\Newsletter_Platform

# Deploy project
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? newsletter-platform
# - In which directory is your code located? ./
# - Want to override settings? No
```

#### Step 2: Configure Environment Variables

In Vercel Dashboard:
1. Go to your project
2. Click **Settings** → **Environment Variables**
3. Add all variables from `.env.local`:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
MAILERLITE_API_KEY
CRON_SECRET
NEXTAUTH_URL (set to production URL)
NEXTAUTH_SECRET
VERCEL_API_KEY
```

#### Step 3: Update Vercel.json for Multi-Tenant

**File: `vercel.json` (UPDATE)**

```json
{
  "crons": [
    {
      "path": "/api/cron/rss-processing",
      "schedule": "*/5 * * * *"
    }
    // ... other cron jobs
  ],
  "functions": {
    "app/api/cron/rss-processing/route.ts": {
      "maxDuration": 720
    }
    // ... other function configs
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

---

## 🌐 Subdomain Setup Guide

### DNS Configuration

#### Step 1: Wildcard DNS Record

In your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare):

1. **Add Wildcard A Record:**
   - Type: `A`
   - Name: `*`
   - Value: Point to Vercel's IP (get from Vercel dashboard)
   - TTL: `Auto` or `3600`

2. **Add Admin Subdomain (if needed separately):**
   - Type: `CNAME`
   - Name: `admin`
   - Value: `cname.vercel-dns.com`
   - TTL: `Auto` or `3600`

#### Step 2: Verify DNS Propagation

```bash
# Check DNS propagation (may take up to 48 hours)
nslookup stcloud.yourdomain.com
nslookup admin.yourdomain.com
```

#### Step 3: Configure Vercel Domains

In Vercel Dashboard:
1. Go to **Settings** → **Domains**
2. Add domains:
   - `admin.yourdomain.com`
   - `*.yourdomain.com` (wildcard for all newsletter subdomains)
3. Wait for SSL certificate provisioning (~10 minutes)

### Testing Subdomains Locally

**File: `C:\Windows\System32\drivers\etc\hosts` (Windows)**

Add entries for local testing:

```
127.0.0.1  admin.localhost
127.0.0.1  stcloud.localhost
127.0.0.1  detroit.localhost
```

Then access:
- `http://admin.localhost:3000` - Admin dashboard
- `http://stcloud.localhost:3000` - St. Cloud newsletter dashboard
- `http://detroit.localhost:3000` - Detroit newsletter dashboard

---

## ✅ Testing Checklist

### Phase 1: Local Development Testing

- [ ] **Database Setup**
  - [ ] Supabase project created successfully
  - [ ] All schema SQL executed without errors
  - [ ] Sample newsletters created (`stcloud`, `detroit`)
  - [ ] Newsletter settings populated for test newsletters

- [ ] **Application Startup**
  - [ ] `npm install` completes successfully
  - [ ] `npm run dev` starts without errors
  - [ ] Can access `http://localhost:3000`

- [ ] **Newsletter Selector Dashboard**
  - [ ] Admin dashboard loads at `http://admin.localhost:3000`
  - [ ] Shows list of active newsletters
  - [ ] Newsletter cards display correct info (name, subdomain, description)
  - [ ] Clicking newsletter navigates to newsletter dashboard

- [ ] **Newsletter-Specific Dashboards**
  - [ ] St. Cloud dashboard loads at `http://stcloud.localhost:3000`
  - [ ] Detroit dashboard loads at `http://detroit.localhost:3000`
  - [ ] Each dashboard shows correct newsletter branding
  - [ ] Campaigns page shows only campaigns for that newsletter

- [ ] **Newsletter Isolation**
  - [ ] Create campaign in St. Cloud newsletter
  - [ ] Verify it doesn't appear in Detroit newsletter
  - [ ] Create event in Detroit newsletter
  - [ ] Verify it doesn't appear in St. Cloud newsletter

### Phase 2: API Testing

- [ ] **Newsletter APIs**
  - [ ] `GET /api/newsletters` returns all newsletters
  - [ ] `GET /api/newsletters/by-subdomain?subdomain=stcloud` returns correct newsletter
  - [ ] `POST /api/newsletters` creates new newsletter successfully

- [ ] **Campaign APIs (with newsletter_id)**
  - [ ] `GET /api/campaigns` returns only campaigns for active newsletter
  - [ ] `POST /api/campaigns` creates campaign with correct newsletter_id
  - [ ] `GET /api/campaigns/[id]` validates newsletter_id matches

- [ ] **Settings APIs (per-newsletter)**
  - [ ] Newsletter settings save correctly per newsletter
  - [ ] St. Cloud can have different RSS feed than Detroit
  - [ ] AI prompts can be customized per newsletter

### Phase 3: Production Deployment Testing

- [ ] **Vercel Deployment**
  - [ ] Code deployed successfully to Vercel
  - [ ] Build completes without errors
  - [ ] All environment variables set correctly

- [ ] **DNS & Subdomains**
  - [ ] Wildcard DNS record propagated
  - [ ] `admin.yourdomain.com` resolves correctly
  - [ ] `stcloud.yourdomain.com` resolves correctly
  - [ ] SSL certificates issued for all subdomains

- [ ] **Production Access**
  - [ ] Admin dashboard accessible at `https://admin.yourdomain.com`
  - [ ] Newsletter dashboards accessible via subdomains
  - [ ] All images and assets load correctly
  - [ ] No mixed content (HTTP/HTTPS) warnings

### Phase 4: End-to-End Workflow Testing

- [ ] **Complete Newsletter Workflow (St. Cloud)**
  - [ ] Create new campaign
  - [ ] Process RSS feed
  - [ ] Articles populate correctly
  - [ ] Events auto-populate
  - [ ] Generate AI subject line
  - [ ] Preview newsletter (correct branding)
  - [ ] Send review email
  - [ ] Approve campaign
  - [ ] Send final newsletter

- [ ] **Complete Newsletter Workflow (Detroit)**
  - [ ] Repeat all steps above for Detroit newsletter
  - [ ] Verify complete isolation from St. Cloud data

- [ ] **Settings Management**
  - [ ] Change St. Cloud RSS feed
  - [ ] Verify Detroit RSS feed unchanged
  - [ ] Customize AI prompts per newsletter
  - [ ] Test AI prompt resets use newsletter-specific defaults

### Phase 5: Performance & Security

- [ ] **Performance**
  - [ ] Page load times < 2 seconds
  - [ ] API response times < 500ms
  - [ ] Image loading optimized
  - [ ] No unnecessary database queries

- [ ] **Security**
  - [ ] Newsletter data isolation verified
  - [ ] Users can only access their assigned newsletters
  - [ ] No newsletter_id leakage in URLs or responses
  - [ ] All API routes validate newsletter_id

---

## 📝 Next Steps After Migration

### 1. Create First Production Newsletter

```bash
# Use Supabase SQL Editor
INSERT INTO newsletters (slug, name, subdomain, description) VALUES
('your-city', 'Your City Newsletter', 'yourcity', 'Daily newsletter for Your City');

# Add settings
INSERT INTO newsletter_settings (newsletter_id, key, value, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'your-city'),
 'rss_feed_url',
 'https://your-rss-feed.com/feed.xml',
 'Primary RSS feed URL');
```

### 2. Migrate Existing St. Cloud Data (Optional)

If you want to move St. Cloud Scoop into the new platform:

```sql
-- Get St. Cloud newsletter ID
SELECT id FROM newsletters WHERE slug = 'stcloud';

-- Update all campaigns with newsletter_id
UPDATE newsletter_campaigns
SET newsletter_id = '<stcloud-newsletter-id>';

-- Repeat for all other tables...
```

### 3. Setup Monitoring & Alerts

- Configure Vercel alerts for deployment failures
- Setup Supabase monitoring for database performance
- Configure Slack/email notifications for cron failures
- Monitor RSS processing success rates per newsletter

### 4. Documentation

- Create internal wiki for adding new newsletters
- Document newsletter-specific AI prompt strategies
- Create troubleshooting guide for common issues
- Maintain changelog for platform updates

---

## 🆘 Troubleshooting

### Issue: Newsletter not loading by subdomain

**Symptoms:** Accessing `stcloud.yourdomain.com` shows 404 or blank page

**Solutions:**
1. Check DNS propagation: `nslookup stcloud.yourdomain.com`
2. Verify wildcard domain added in Vercel dashboard
3. Check middleware is active (check `src/middleware.ts`)
4. Check browser console for errors
5. Verify newsletter exists in database with matching subdomain

### Issue: Database queries returning wrong newsletter's data

**Symptoms:** Seeing another newsletter's campaigns/articles

**Solutions:**
1. Check `newsletter_id` is being passed in request headers
2. Verify all queries include `.eq('newsletter_id', newsletter_id)`
3. Check middleware is setting correct newsletter context
4. Review database indexes on `newsletter_id` columns

### Issue: Cron jobs not running for specific newsletter

**Symptoms:** RSS processing not creating campaigns for a newsletter

**Solutions:**
1. Check cron job logs in Vercel dashboard
2. Verify newsletter settings include required fields (RSS URL, etc.)
3. Check `CRON_SECRET` matches in both places
4. Review cron route code for newsletter filtering logic

---

## 📚 Additional Resources

- [Supabase Multi-Tenancy Guide](https://supabase.com/docs/guides/database/multi-tenancy)
- [Vercel Wildcard Domains](https://vercel.com/docs/concepts/projects/domains/wildcard-domains)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Row Level Security in Postgres](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## 🎉 Summary

This migration guide provides everything needed to transform the single-tenant St. Cloud Scoop into a **multi-tenant newsletter platform** where:

✅ **Multiple newsletters** can coexist in one system
✅ **Complete data isolation** between newsletters
✅ **Shared infrastructure** reduces costs and maintenance
✅ **Subdomain-based** professional architecture
✅ **Highly customizable** per-newsletter settings
✅ **Single admin access** for simplicity

**Estimated Time to Complete:** 8-12 hours (depending on experience level)

**Questions or Issues?** Refer to the troubleshooting section or reach out for assistance!

---

**Last Updated:** 2025-10-13
**Version:** 1.0
**Author:** Claude (AI Assistant)
