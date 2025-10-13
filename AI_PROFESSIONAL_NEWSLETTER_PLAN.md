# AI Professional Newsletter Platform - Implementation Plan

**Created:** 2025-10-13
**Target Launch:** Test emails by end of week (2025-10-17)
**First Newsletter:** Accounting AI Applications

---

## 🎯 Project Overview

### What We're Building

A **multi-tenant newsletter platform** for AI applications tailored to specific professions:
- **First Newsletter:** Accounting professionals
- **Future Newsletters:** Other professions (legal, medical, engineering, etc.)
- **Content Focus:** AI tools, applications, and prompt ideas specific to each profession

### Key Differences from St. Cloud Scoop

| Feature | St. Cloud Scoop | AI Professional Newsletters |
|---------|----------------|---------------------------|
| **Focus** | Local news & events | AI applications for professions |
| **RSS Articles** | Unlimited, auto-ranked | 6 total (3 + 3 split by ad) |
| **Special Sections** | Events, dining, road work | AI apps (5), prompt ideas (variable) |
| **Welcome Section** | None | Article titles overview |
| **Audience** | Geographic (St. Cloud, MN) | Professional (Accountants, etc.) |

---

## 📐 Newsletter Layout Design

### Section Order & Structure

```
┌─────────────────────────────────────────────────────┐
│ 1. HEADER (Newsletter Branding)                     │
├─────────────────────────────────────────────────────┤
│ 2. WELCOME SECTION                                  │
│    • One-line titles of all 6 articles              │
│    • "In today's newsletter:"                       │
│    • Bullet list with article headlines            │
├─────────────────────────────────────────────────────┤
│ 3. ADVERTISEMENT                                    │
│    • Same format as St. Cloud Scoop ads             │
│    • Rotates through active ads                     │
├─────────────────────────────────────────────────────┤
│ 4. TOP 3 ARTICLES (RSS Feed)                        │
│    • AI-ranked articles                             │
│    • Full content with images                       │
├─────────────────────────────────────────────────────┤
│ 5. AI APPLICATIONS (5 Links)                        │
│    • Database-driven (similar to dining deals)      │
│    • App name, description, category, link          │
│    • Tracks clicks                                  │
├─────────────────────────────────────────────────────┤
│ 6. BOTTOM 3 ARTICLES (RSS Feed)                     │
│    • Articles ranked #4, #5, #6                     │
│    • Full content with images                       │
├─────────────────────────────────────────────────────┤
│ 7. PROMPT IDEAS SECTION                             │
│    • Profession-specific AI prompts                 │
│    • Database-driven                                │
│    • Variable count (3-5 prompts per newsletter)    │
├─────────────────────────────────────────────────────┤
│ 8. FOOTER                                           │
│    • Unsubscribe link                               │
│    • Social media links                             │
└─────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema Design

### New Tables Required

#### 1. AI Applications Table

```sql
CREATE TABLE ai_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

  -- Application Details
  app_name TEXT NOT NULL,
  tagline TEXT, -- Short one-liner (max 80 chars)
  description TEXT NOT NULL, -- Full description (max 200 chars)
  category TEXT, -- e.g., "Automation", "Analysis", "Writing", "Research"

  -- Links & Images
  app_url TEXT NOT NULL, -- Direct link to application
  tracked_link TEXT, -- MailerLite tracked link
  logo_url TEXT, -- Optional app logo/icon
  screenshot_url TEXT, -- Optional screenshot

  -- Metadata
  pricing TEXT, -- "Free", "Freemium", "Paid", "$X/mo"
  is_featured BOOLEAN DEFAULT false,
  is_paid_placement BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Display & Rotation
  display_order INT, -- Manual ordering if needed
  last_used_date DATE, -- Track when last included in newsletter
  times_used INT DEFAULT 0, -- Usage counter

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_apps_newsletter ON ai_applications(newsletter_id);
CREATE INDEX idx_ai_apps_active ON ai_applications(is_active);
CREATE INDEX idx_ai_apps_category ON ai_applications(category);

-- Example data for Accounting newsletter
INSERT INTO ai_applications (newsletter_id, app_name, tagline, description, category, app_url, pricing) VALUES
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'QuickBooks AI Assistant',
  'Automate your bookkeeping with AI',
  'AI-powered accounting assistant that categorizes transactions, detects anomalies, and generates financial reports automatically.',
  'Automation',
  'https://quickbooks.intuit.com/ai',
  'Freemium'
);
```

#### 2. Campaign AI App Selections Table

```sql
CREATE TABLE campaign_ai_app_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES ai_applications(id) ON DELETE CASCADE,
  selection_order INT NOT NULL, -- 1-5 for display position
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, app_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_apps_campaign ON campaign_ai_app_selections(campaign_id);
```

#### 3. Prompt Ideas Table

```sql
CREATE TABLE prompt_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

  -- Prompt Details
  title TEXT NOT NULL, -- e.g., "Analyze Cash Flow Trends"
  prompt_text TEXT NOT NULL, -- Full prompt template (max 500 chars)
  category TEXT, -- e.g., "Financial Analysis", "Client Communication", "Reporting"
  use_case TEXT, -- Brief explanation of when to use (max 150 chars)

  -- AI Model Suggestions
  suggested_model TEXT, -- e.g., "ChatGPT", "Claude", "Gemini", "Any"

  -- Metadata
  difficulty_level TEXT, -- "Beginner", "Intermediate", "Advanced"
  estimated_time TEXT, -- e.g., "2 minutes", "5 minutes"
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Display & Rotation
  display_order INT,
  last_used_date DATE,
  times_used INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_ideas_newsletter ON prompt_ideas(newsletter_id);
CREATE INDEX idx_prompt_ideas_active ON prompt_ideas(is_active);
CREATE INDEX idx_prompt_ideas_category ON prompt_ideas(category);

-- Example data for Accounting newsletter
INSERT INTO prompt_ideas (newsletter_id, title, prompt_text, category, use_case, suggested_model, difficulty_level) VALUES
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Analyze Monthly Cash Flow',
  'Review the following cash flow data from [Month]: [paste data]. Identify trends, potential issues, and provide 3 actionable recommendations to improve cash flow in the next quarter.',
  'Financial Analysis',
  'Use this when reviewing monthly financials with clients to quickly identify key insights.',
  'ChatGPT',
  'Beginner'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Draft Tax Deadline Reminder Email',
  'Write a professional email to clients reminding them of the [Tax Deadline Date] deadline. Include: 1) Required documents, 2) Consequences of missing deadline, 3) How to schedule appointment. Tone: Professional but friendly.',
  'Client Communication',
  'Save time during tax season by generating personalized reminder emails.',
  'Claude',
  'Beginner'
);
```

#### 4. Campaign Prompt Selections Table

```sql
CREATE TABLE campaign_prompt_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompt_ideas(id) ON DELETE CASCADE,
  selection_order INT NOT NULL, -- 1-5 for display position
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, prompt_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_prompts_campaign ON campaign_prompt_selections(campaign_id);
```

#### 5. Update Newsletter Sections Table

```sql
-- Delete old sections or mark inactive
UPDATE newsletter_sections SET is_active = false WHERE newsletter_id IS NULL;

-- Insert new sections for Accounting newsletter
INSERT INTO newsletter_sections (newsletter_id, name, display_order, is_active) VALUES
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Welcome', 1, true),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Advertisement', 2, true),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Top Articles', 3, true),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'AI Applications', 4, true),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Bottom Articles', 5, true),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Prompt Ideas', 6, true);
```

---

## 🚀 Rapid Implementation Timeline (5 Days)

### Day 1 (Monday): Project Setup & Database

**Tasks:**
- [ ] Copy St. Cloud Scoop to new `AI_Newsletter_Platform` directory
- [ ] Create new Supabase project
- [ ] Run all database schema SQL scripts
- [ ] Create first newsletter: "Accounting AI Daily"
- [ ] Set up `.env.local` with new credentials

**Estimated Time:** 2-3 hours

---

### Day 2 (Tuesday): Core Code Modifications

**Tasks:**
- [ ] Add newsletter context provider
- [ ] Update all API routes to use `newsletter_id`
- [ ] Create newsletter selector dashboard
- [ ] Test basic multi-tenant functionality locally

**Estimated Time:** 4-5 hours

---

### Day 3 (Wednesday): New Sections Implementation

**Tasks:**
- [ ] Create AI Applications database management page
- [ ] Create Prompt Ideas database management page
- [ ] Add 10-15 sample AI apps for accounting
- [ ] Add 10-15 sample prompt ideas for accounting
- [ ] Update newsletter preview generator for new layout

**Estimated Time:** 5-6 hours

---

### Day 4 (Thursday): Newsletter Layout & Testing

**Tasks:**
- [ ] Implement Welcome section HTML generator
- [ ] Update article selection logic (6 articles: 3 + 3 split)
- [ ] Implement AI Applications section HTML generator
- [ ] Implement Prompt Ideas section HTML generator
- [ ] Test complete newsletter generation locally
- [ ] Verify all sections render correctly

**Estimated Time:** 4-5 hours

---

### Day 5 (Friday): Deployment & Test Email

**Tasks:**
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Set up MailerLite test group
- [ ] Create first test campaign
- [ ] Send test email to team
- [ ] Review and iterate based on feedback

**Estimated Time:** 3-4 hours

**Target:** Test email sent by end of day Friday (2025-10-17)

---

## 📧 MailerLite Configuration

### Setup Strategy

**Shared Account, Different Groups & Emails:**

```
MailerLite Account: AI Professional Newsletters
├── Group: Accounting AI (Test)
├── Group: Accounting AI (Production)
├── Group: Legal AI (Test) [future]
└── Group: Legal AI (Production) [future]

Sender Emails:
├── accounting@aiprosnewsletter.com (or similar)
├── legal@aiprosnewsletter.com [future]
└── admin@aiprosnewsletter.com (internal)
```

### Newsletter Settings Table Configuration

```sql
-- Accounting newsletter MailerLite settings
INSERT INTO newsletter_settings (newsletter_id, key, value, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'accounting'),
 'mailerlite_test_group_id',
 'YOUR_TEST_GROUP_ID',
 'MailerLite test group ID for Accounting newsletter'),

((SELECT id FROM newsletters WHERE slug = 'accounting'),
 'mailerlite_main_group_id',
 'YOUR_MAIN_GROUP_ID',
 'MailerLite production group ID for Accounting newsletter'),

((SELECT id FROM newsletters WHERE slug = 'accounting'),
 'from_email',
 'accounting@yourdomain.com',
 'Email sender address'),

((SELECT id FROM newsletters WHERE slug = 'accounting'),
 'sender_name',
 'Accounting AI Daily',
 'Email sender name');
```

---

## 🎨 Welcome Section Implementation

### HTML Template

```typescript
// src/lib/newsletter-generators/welcome-section.ts

export function generateWelcomeSection(articles: Article[]): string {
  const articleTitles = articles
    .slice(0, 6)
    .map((article, index) => `
      <li style="margin-bottom: 8px; color: #374151; font-size: 15px;">
        <strong>${article.headline}</strong>
      </li>
    `)
    .join('')

  return `
    <div style="background-color: #F9FAFB; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
      <h2 style="color: #1F2937; font-size: 20px; font-weight: 600; margin-bottom: 16px;">
        📬 In Today's Newsletter
      </h2>
      <ul style="list-style: none; padding-left: 0; margin: 0;">
        ${articleTitles}
      </ul>
    </div>
  `
}
```

---

## 🔧 AI Applications Section Implementation

### HTML Template

```typescript
// src/lib/newsletter-generators/ai-apps-section.ts

interface AIApp {
  app_name: string
  tagline: string
  description: string
  category: string
  app_url: string
  tracked_link: string
  logo_url?: string
  pricing: string
}

export function generateAIAppsSection(apps: AIApp[]): string {
  const appCards = apps.map((app, index) => `
    <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; align-items: start; gap: 16px;">
        ${app.logo_url ? `
          <img src="${app.logo_url}" alt="${app.app_name}" style="width: 48px; height: 48px; border-radius: 8px;" />
        ` : ''}

        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 style="color: #1F2937; font-size: 18px; font-weight: 600; margin: 0;">
              ${app.app_name}
            </h3>
            <span style="background-color: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">
              ${app.pricing}
            </span>
          </div>

          ${app.tagline ? `
            <p style="color: #6B7280; font-size: 14px; font-style: italic; margin: 0 0 8px 0;">
              ${app.tagline}
            </p>
          ` : ''}

          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
            ${app.description}
          </p>

          <div style="display: flex; gap: 12px; align-items: center;">
            <a href="${app.tracked_link || app.app_url}"
               style="background-color: #3B82F6; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
              Try ${app.app_name} →
            </a>
            <span style="color: #9CA3AF; font-size: 13px;">
              ${app.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  `).join('')

  return `
    <div style="margin-bottom: 48px;">
      <h2 style="color: #1F2937; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 2px solid #3B82F6; padding-bottom: 12px;">
        🤖 AI Tools for Accountants
      </h2>
      ${appCards}
    </div>
  `
}
```

---

## 💡 Prompt Ideas Section Implementation

### HTML Template

```typescript
// src/lib/newsletter-generators/prompt-ideas-section.ts

interface PromptIdea {
  title: string
  prompt_text: string
  category: string
  use_case: string
  suggested_model: string
  difficulty_level: string
}

export function generatePromptIdeasSection(prompts: PromptIdea[]): string {
  const promptCards = prompts.map((prompt, index) => `
    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <h3 style="color: #92400E; font-size: 18px; font-weight: 600; margin: 0;">
          ${index + 1}. ${prompt.title}
        </h3>
        <span style="background-color: #FCD34D; color: #78350F; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500;">
          ${prompt.difficulty_level}
        </span>
      </div>

      <p style="color: #78350F; font-size: 14px; margin: 0 0 12px 0; font-style: italic;">
        ${prompt.use_case}
      </p>

      <div style="background-color: #FFFBEB; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
        <code style="color: #92400E; font-size: 14px; line-height: 1.6; white-space: pre-wrap; font-family: 'Courier New', monospace;">
${prompt.prompt_text}
        </code>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="color: #92400E; font-size: 13px;">
          💬 Best for: <strong>${prompt.suggested_model}</strong>
        </span>
        <span style="color: #B45309; font-size: 13px;">
          • ${prompt.category}
        </span>
      </div>
    </div>
  `).join('')

  return `
    <div style="margin-bottom: 48px;">
      <h2 style="color: #1F2937; font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 2px solid #F59E0B; padding-bottom: 12px;">
        💡 AI Prompts to Try This Week
      </h2>
      <p style="color: #6B7280; font-size: 15px; margin-bottom: 24px;">
        Copy and paste these prompts into ChatGPT, Claude, or your favorite AI assistant to save time and improve accuracy.
      </p>
      ${promptCards}
    </div>
  `
}
```

---

## 📂 New File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── newsletters/
│   │       ├── page.tsx                    # Newsletter selector dashboard
│   │       └── [slug]/
│   │           ├── page.tsx                # Newsletter-specific dashboard
│   │           ├── campaigns/
│   │           ├── ai-apps/                # NEW: AI Applications management
│   │           │   └── page.tsx
│   │           ├── prompt-ideas/           # NEW: Prompt Ideas management
│   │           │   └── page.tsx
│   │           └── settings/
│   ├── api/
│   │   ├── newsletters/                    # NEW: Newsletter management APIs
│   │   │   ├── route.ts
│   │   │   └── by-subdomain/route.ts
│   │   ├── ai-apps/                        # NEW: AI Applications APIs
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── available/route.ts
│   │   ├── prompt-ideas/                   # NEW: Prompt Ideas APIs
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── available/route.ts
│   │   └── campaigns/
│   │       └── [id]/
│   │           ├── ai-apps/route.ts        # NEW: Campaign AI app selection
│   │           └── prompt-ideas/route.ts   # NEW: Campaign prompt selection
├── lib/
│   ├── newsletter-generators/              # NEW: Section generators
│   │   ├── welcome-section.ts
│   │   ├── ai-apps-section.ts
│   │   ├── prompt-ideas-section.ts
│   │   └── index.ts
│   └── newsletter-supabase.ts              # NEW: Multi-tenant Supabase client
└── types/
    └── database.ts                         # Update with new types
```

---

## 🔍 Modified vs New Components

### Components to Modify from St. Cloud Scoop

1. **Campaign Preview Generator** (`/api/campaigns/[id]/preview/route.ts`)
   - Update to use new 6-section layout
   - Replace Local Events with AI Applications
   - Replace Road Work with Prompt Ideas
   - Add Welcome section at top

2. **Article Selection Logic** (`src/lib/rss-processor.ts`)
   - Change from "activate top 5" to "activate top 6"
   - Split articles: 3 before AI Apps, 3 after

3. **Newsletter Sections Management** (`/app/dashboard/settings/page.tsx`)
   - Per-newsletter section configuration
   - Dynamic section ordering

### Components to Keep as-is

1. **RSS Processing** - Same logic, just different article count
2. **AI Subject Line Generation** - Reuse existing system
3. **MailerLite Integration** - Reuse with different group IDs
4. **Image Management** - Reuse entire system
5. **Advertisement System** - Reuse exactly as-is
6. **Campaign Status Workflow** - Reuse entire workflow

---

## ✅ Pre-Launch Checklist (Friday Morning)

### Database Verification

- [ ] Supabase project created and accessible
- [ ] All schema SQL executed successfully
- [ ] `newsletters` table has "Accounting AI Daily" entry
- [ ] `newsletter_settings` table populated with MailerLite credentials
- [ ] `ai_applications` table has 10+ entries
- [ ] `prompt_ideas` table has 10+ entries

### Code Deployment

- [ ] All code changes committed to Git
- [ ] Vercel project deployed successfully
- [ ] Environment variables configured
- [ ] Build completes without errors
- [ ] Production URL accessible

### Newsletter Content

- [ ] Test campaign created
- [ ] RSS feed configured for AI/accounting news
- [ ] 6 articles selected and ranked
- [ ] 5 AI apps selected for newsletter
- [ ] 3-5 prompt ideas selected for newsletter
- [ ] 1 advertisement selected
- [ ] Subject line generated
- [ ] Preview looks correct

### Email Testing

- [ ] MailerLite test group created
- [ ] Test email addresses added to group
- [ ] Sender email verified in MailerLite
- [ ] Test email sent successfully
- [ ] Email renders correctly in:
  - [ ] Gmail
  - [ ] Outlook
  - [ ] Apple Mail
  - [ ] Mobile devices

---

## 🎯 Success Metrics

**By Friday End of Day:**

✅ Test email sent to team
✅ All 6 sections render correctly
✅ Links are tracked properly
✅ Email displays on desktop and mobile
✅ No broken images or layout issues

**Next Week Goals:**

- Gather feedback from test email
- Iterate on design and content
- Add 20+ more AI applications
- Add 20+ more prompt ideas
- Create production subscriber group
- Send first production newsletter

---

## 🆘 Contingency Plans

### If Behind Schedule by Wednesday Night

**Simplification Options:**
1. Skip subdomain setup, use path-based routing (`/accounting/dashboard`)
2. Manual AI app selection instead of rotation logic
3. Use simpler HTML templates (text-only prompts)
4. Deploy to staging only, not production

### If Technical Issues on Thursday

**Backup Plan:**
1. Use St. Cloud Scoop codebase with minimal modifications
2. Hardcode "Accounting" newsletter (no multi-tenant yet)
3. Manual newsletter generation in MailerLite UI
4. Migrate to full platform next week

---

## 📞 Support & Questions

**As we build this week, ask for help with:**
- Specific code snippets for any section
- Database query optimization
- HTML email template troubleshooting
- MailerLite API integration issues
- Vercel deployment problems

**I'm here to help with:**
- Writing complete code files
- Debugging errors
- Schema modifications
- Testing strategies
- Performance optimization

---

## 🚀 Let's Get Started!

**First Step:** Decide on the new project directory name and domain strategy.

**Suggested Project Name:** `AI_Pros_Newsletter` or `Professional_AI_Daily`

**Temporary Domain Options (until you purchase):**
- Use Vercel's free subdomain: `accounting-ai.vercel.app`
- Test locally: `http://localhost:3000`
- Deploy later with custom domain

**Ready to start Phase 1 (Database Setup)?** Let me know and I'll guide you through creating the Supabase project and running all the SQL scripts!

---

**Last Updated:** 2025-10-13
**Target:** Test email by 2025-10-17
**Status:** Ready to begin implementation
