# Welcome Section Implementation Plan

## Overview
Add a dynamic Welcome section to the newsletter that:
- Appears first in the email (after header, before primary articles)
- Summarizes the key stories in the current newsletter
- **Uses ALL selected primary AND secondary articles** (not just top 5)
- Auto-generates at the end of RSS processing
- Regenerates whenever articles change during review
- **Fully editable and testable in Settings > AI Prompts page**

## Key Requirements ✅
1. ✅ **Prompt appears in Settings > AI Prompts** - Can be edited, tested, saved as default
2. ✅ **Uses ALL active articles** - Combines primary + secondary articles for comprehensive summary
3. ✅ **Test Prompt button works** - Includes sample test data in test API endpoint
4. ✅ **Conversational style** - Matches reference newsletter examples (e.g., "Hey, AI Enthusiast!")
5. ✅ **Auto-regenerates** - Updates when articles change, toggles, or reorder

## Examples (from similar newsletter)
```
Hey, AI Enthusiast!

Welcome back to the world's #1 AI newsletter.

Today, we've got OpenAI's first AI browser, why Sonnet 4.5 is making devs rethink their entire coding setup, OpenAI's first federal search warrant, and a "magic prompt" researchers claim unlocks AI creativity through probability scoring.
```

```
Hey, AI Enthusiast!

Welcome back to the #1 AI newsletter in the world.

Today, we're taking a look at an AI assistant trained on journals that doctors will use to treat patients faster, why Andrej Karpathy says working AI agents are still 10 years away, why raw human creativity beats AI execution, and more.
```

## Implementation Steps

### 1. Database Schema Changes

**Add `welcome_section` column to `newsletter_campaigns` table:**

```sql
-- Migration: db/migrations/add_welcome_section.sql

ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS welcome_section TEXT;

COMMENT ON COLUMN newsletter_campaigns.welcome_section IS 'AI-generated welcome text that summarizes the newsletter contents';
```

**Rationale:** Store the generated welcome text directly in the campaign record for easy access and modification during review.

---

### 2. AI Prompt for Welcome Generation

**Create new prompt in `app_settings` table:**

**Key:** `ai_prompt_welcome_section`

**Description:** `General - Welcome Section: Generates newsletter introduction based on all selected articles`

**Important:** This prompt will appear in Settings > AI Prompts page where it can be edited, tested, and customized.

**Prompt Structure (Plain Text):**
```
You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, [Audience]!" (use appropriate audience name)
- Include tagline (e.g., "Welcome back to Central Minnesota's #1 local news newsletter.")
- Weave in 3-5 key stories from today's newsletter in a flowing, natural sentence
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)

GUIDELINES:
- Use "Today, we've got..." or "Today, we're covering..." or "Today, we're taking a look at..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences
- Select the most compelling/newsworthy stories to highlight

ARTICLES TO SUMMARIZE (Primary and Secondary):
{{articles}}

Return ONLY the welcome text (no additional formatting or explanation).
```

**Or Structured JSON Format:**
```json
{
  "model": "gpt-4o",
  "temperature": 0.8,
  "top_p": 0.9,
  "max_tokens": 300,
  "messages": [
    {
      "role": "system",
      "content": "You are writing engaging, conversational newsletter introductions. Your goal is to hook readers with a friendly greeting and compelling story teasers."
    },
    {
      "role": "assistant",
      "content": "Hey, Central Minnesota!\n\nWelcome back to your daily local news roundup.\n\nToday, we're covering a major development at the St. Cloud City Council, why local businesses are embracing AI tools, the new downtown park opening this weekend, and the high school team heading to state championships."
    },
    {
      "role": "user",
      "content": "Write a welcoming 3-4 sentence introduction for today's newsletter. Start with \"Hey, [Audience]!\" then include the tagline, then list 3-5 key stories in one flowing sentence using \"Today, we've got...\" or similar. Focus on intrigue and curiosity.\n\nArticles:\n{{articles}}\n\nReturn only the welcome text."
    }
  ]
}
```

**Add to database:**
```sql
INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_welcome_section',
  'You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, [Audience]!" (use appropriate audience name)
- Include tagline (e.g., "Welcome back to Central Minnesota''s #1 local news newsletter.")
- Weave in 3-5 key stories from today''s newsletter in a flowing, natural sentence
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)

GUIDELINES:
- Use "Today, we''ve got..." or "Today, we''re covering..." or "Today, we''re taking a look at..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences
- Select the most compelling/newsworthy stories to highlight

ARTICLES TO SUMMARIZE (Primary and Secondary):
{{articles}}

Return ONLY the welcome text (no additional formatting or explanation).',
  'General - Welcome Section: Generates newsletter introduction based on all selected articles'
);
```

---

### 3. Code Implementation

#### 3.1 Add Welcome Generation Function (openai.ts)

**Location:** `src/lib/openai.ts`

**Add to AI_PROMPTS object:**

```typescript
welcomeSection: async (articles: Array<{ headline: string; content: string }>) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_prompt_welcome_section')
      .single()

    if (error || !data) {
      console.log('[AI] Using fallback for welcomeSection prompt')
      return FALLBACK_PROMPTS.welcomeSection(articles)
    }

    console.log('[AI] Using database prompt for welcomeSection')

    // Format articles for the prompt
    const articlesText = articles
      .map((article, index) => `${index + 1}. ${article.headline}\n   ${article.content.substring(0, 200)}...`)
      .join('\n\n')

    // Check if structured JSON prompt
    try {
      const promptConfig = JSON.parse(data.value) as StructuredPromptConfig

      if (promptConfig.messages && Array.isArray(promptConfig.messages)) {
        console.log('[AI] Detected structured JSON prompt for welcomeSection')
        const placeholders = {
          articles: articlesText
        }
        return await callWithStructuredPrompt(promptConfig, placeholders)
      }
    } catch (jsonError) {
      console.log('[AI] Using plain text prompt for welcomeSection')
    }

    // Plain text prompt
    return data.value.replace(/\{\{articles\}\}/g, articlesText)
  } catch (error) {
    console.error('[AI] Error fetching welcomeSection prompt, using fallback:', error)
    return FALLBACK_PROMPTS.welcomeSection(articles)
  }
},
```

**Add to FALLBACK_PROMPTS:**

```typescript
welcomeSection: (articles: Array<{ headline: string; content: string }>) => {
  const articlesText = articles
    .map((article, index) => `${index + 1}. ${article.headline}\n   ${article.content.substring(0, 200)}...`)
    .join('\n\n')

  return `You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, Central Minnesota!"
- Include tagline: "Welcome back to your daily local news roundup."
- List 3-5 key stories from today's newsletter in a flowing sentence
- Natural, engaging language that creates curiosity

GUIDELINES:
- Use "Today, we've got..." or "Today, we're covering..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences

ARTICLES TO SUMMARIZE:
${articlesText}

Return ONLY the welcome text (no additional formatting or explanation).`
},
```

---

#### 3.2 Generate Welcome Section in RSS Processing

**Location:** `src/lib/rss-processor.ts`

**Add function to RSSProcessor class:**

```typescript
private async generateWelcomeSection(campaignId: string): Promise<string> {
  console.log('[RSS] Generating welcome section...')

  try {
    // Fetch ALL active PRIMARY articles for this campaign
    const { data: primaryArticles, error: primaryError } = await supabaseAdmin
      .from('articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (primaryError) {
      console.error('[RSS] Error fetching primary articles for welcome:', primaryError)
      throw primaryError
    }

    // Fetch ALL active SECONDARY articles for this campaign
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (secondaryError) {
      console.error('[RSS] Error fetching secondary articles for welcome:', secondaryError)
      throw secondaryError
    }

    // Combine ALL articles (primary first, then secondary)
    const allArticles = [
      ...(primaryArticles || []),
      ...(secondaryArticles || [])
    ]

    if (allArticles.length === 0) {
      console.log('[RSS] No articles found, skipping welcome section')
      return ''
    }

    console.log(`[RSS] Generating welcome from ${primaryArticles?.length || 0} primary and ${secondaryArticles?.length || 0} secondary articles`)

    // Generate welcome text using AI
    const promptOrResult = await AI_PROMPTS.welcomeSection(allArticles)

    // Handle both prompt strings and structured prompt results
    const welcomeText = (typeof promptOrResult === 'object' && promptOrResult !== null && 'raw' in promptOrResult)
      ? (typeof promptOrResult.raw === 'string' ? promptOrResult.raw : promptOrResult.raw?.text || '')
      : await callOpenAI(promptOrResult as string, 500, 0.8)

    const finalWelcomeText = typeof welcomeText === 'string'
      ? welcomeText.trim()
      : (welcomeText.text || welcomeText.raw || '').trim()

    console.log('[RSS] Welcome section generated (length:', finalWelcomeText.length, ')')

    // Save to campaign
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({ welcome_section: finalWelcomeText })
      .eq('id', campaignId)

    if (updateError) {
      console.error('[RSS] Error saving welcome section:', updateError)
      throw updateError
    }

    return finalWelcomeText
  } catch (error) {
    console.error('[RSS] Failed to generate welcome section:', error)
    // Don't fail the entire process if welcome fails
    return ''
  }
}
```

**Call in finalize step:**

**Location:** Around line 1450-1500 in `src/lib/rss-processor.ts` (in the finalize method)

```typescript
// After articles are finalized and before marking as in_review
console.log('[RSS] Step 4: Finalizing campaign...')

// Generate welcome section
await this.generateWelcomeSection(campaignId)

// Mark campaign as complete
await supabaseAdmin
  .from('newsletter_campaigns')
  .update({
    status: 'in_review',
    updated_at: new Date().toISOString()
  })
  .eq('id', campaignId)
```

---

#### 3.3 Regenerate on Article Changes

**Location:** `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` (or wherever articles are updated during review)

**Add regeneration function:**

```typescript
async function regenerateWelcomeSection(campaignId: string) {
  try {
    const response = await fetch(`/api/campaigns/${campaignId}/regenerate-welcome`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to regenerate welcome section')
    }

    // Reload campaign data to show updated welcome
    await loadCampaign()
  } catch (error) {
    console.error('Error regenerating welcome:', error)
  }
}
```

**Create API endpoint:**

**File:** `src/app/api/campaigns/[id]/regenerate-welcome/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

    // Fetch ALL active PRIMARY articles for this campaign
    const { data: primaryArticles, error: primaryError } = await supabaseAdmin
      .from('articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (primaryError) {
      throw primaryError
    }

    // Fetch ALL active SECONDARY articles for this campaign
    const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
      .from('secondary_articles')
      .select('headline, content')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (secondaryError) {
      throw secondaryError
    }

    // Combine ALL articles (primary first, then secondary)
    const allArticles = [
      ...(primaryArticles || []),
      ...(secondaryArticles || [])
    ]

    if (allArticles.length === 0) {
      return NextResponse.json({
        error: 'No active articles found'
      }, { status: 400 })
    }

    // Generate welcome text from ALL articles
    const promptOrResult = await AI_PROMPTS.welcomeSection(allArticles)

    const welcomeText = (typeof promptOrResult === 'object' && promptOrResult !== null && 'raw' in promptOrResult)
      ? (typeof promptOrResult.raw === 'string' ? promptOrResult.raw : promptOrResult.raw?.text || '')
      : await callOpenAI(promptOrResult as string, 500, 0.8)

    const finalWelcomeText = typeof welcomeText === 'string'
      ? welcomeText.trim()
      : (welcomeText.text || welcomeText.raw || '').trim()

    // Update campaign
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        welcome_section: finalWelcomeText,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      welcome_section: finalWelcomeText
    })

  } catch (error) {
    console.error('Error regenerating welcome section:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
```

---

#### 3.4 Add Welcome Section to Email Template

**Location:** `src/lib/newsletter-templates.ts`

**Add new function:**

```typescript
// ==================== WELCOME SECTION ====================

export async function generateWelcomeSection(welcomeText: string): Promise<string> {
  if (!welcomeText || welcomeText.trim() === '') {
    return ''
  }

  // Fetch colors from business settings
  const { primaryColor } = await fetchBusinessColors()

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff;">
  <tr>
    <td style="padding: 20px;">
      <div style="font-size: 16px; line-height: 24px; color: #333; font-family: Arial, sans-serif;">
        ${welcomeText.replace(/\n/g, '<br>')}
      </div>
    </td>
  </tr>
</table>
<br>`
}
```

**Integrate into main template:**

**Location:** In the main newsletter generation function (wherever sections are assembled)

```typescript
// After header, before primary articles
const welcomeHtml = campaign.welcome_section
  ? await generateWelcomeSection(campaign.welcome_section)
  : ''

// Assemble newsletter
const newsletterHtml = `
  ${headerHtml}
  ${welcomeHtml}
  ${primaryArticlesHtml}
  ${secondaryArticlesHtml}
  ${eventsHtml}
  ${roadWorkHtml}
  ${footerHtml}
`
```

---

### 4. UI Integration

#### 4.1 Campaign Review Page

**Location:** `src/app/dashboard/[slug]/campaigns/[id]/page.tsx`

**Add Welcome Section display and edit:**

```tsx
{/* Welcome Section */}
{campaign.welcome_section && (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-lg font-semibold">Welcome Section</h3>
      <button
        onClick={() => regenerateWelcomeSection(campaign.id)}
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        Regenerate
      </button>
    </div>
    <div className="bg-gray-50 p-4 rounded border">
      <p className="whitespace-pre-wrap">{campaign.welcome_section}</p>
    </div>
  </div>
)}
```

**Add edit capability (optional):**

```tsx
const [editingWelcome, setEditingWelcome] = useState(false)
const [welcomeText, setWelcomeText] = useState(campaign.welcome_section || '')

// In the UI:
{editingWelcome ? (
  <div>
    <textarea
      value={welcomeText}
      onChange={(e) => setWelcomeText(e.target.value)}
      className="w-full h-32 p-2 border rounded"
    />
    <div className="flex gap-2 mt-2">
      <button onClick={() => saveWelcomeSection()}>Save</button>
      <button onClick={() => setEditingWelcome(false)}>Cancel</button>
    </div>
  </div>
) : (
  <div>
    <p>{campaign.welcome_section}</p>
    <button onClick={() => setEditingWelcome(true)}>Edit</button>
  </div>
)}
```

---

### 5. Trigger Points for Regeneration

**Automatically regenerate welcome section when:**

1. ✅ **End of RSS Processing** - Initial generation
2. ✅ **Article is toggled active/inactive** - Articles list changes
3. ✅ **Article rank is changed** - Order changes (affects which stories are highlighted)
4. ✅ **Manual regenerate button** - User explicitly requests

**Implementation:**

In the article update functions, add:

```typescript
// After updating articles
await fetch(`/api/campaigns/${campaignId}/regenerate-welcome`, {
  method: 'POST'
})
```

---

### 6. Settings > AI Prompts Integration

**The welcome section prompt MUST appear on the Settings > AI Prompts page for editing and testing.**

#### 6.1 Add to Settings Page Prompt Mapping

**Location:** `src/app/dashboard/[slug]/settings/page.tsx`

**Find the `promptTypeMap` object and add:**

```typescript
const promptTypeMap: Record<string, string> = {
  'ai_prompt_content_evaluator': 'contentEvaluator',
  'ai_prompt_newsletter_writer': 'newsletterWriter',
  'ai_prompt_subject_line': 'subjectLineGenerator',
  'ai_prompt_event_summary': 'eventSummarizer',
  'ai_prompt_road_work': 'roadWorkGenerator',
  'ai_prompt_image_analyzer': 'imageAnalyzer',
  'ai_prompt_primary_article_title': 'primaryArticleTitle',
  'ai_prompt_primary_article_body': 'primaryArticleBody',
  'ai_prompt_secondary_article_title': 'secondaryArticleTitle',
  'ai_prompt_secondary_article_body': 'secondaryArticleBody',
  'ai_prompt_fact_checker': 'factChecker',
  'ai_prompt_welcome_section': 'welcomeSection'  // ADD THIS LINE
}
```

#### 6.2 Add Test Handler in Test API

**Location:** `src/app/api/debug/test-ai-prompts/route.ts`

**Add test handler for welcome section:**

```typescript
// Test Welcome Section
if (promptType === 'all' || promptType === 'welcomeSection') {
  console.log('Testing Welcome Section...')
  try {
    // Fetch sample articles for testing
    const testArticles = [
      {
        headline: 'AI Tool Revolutionizes Tax Preparation for CPAs',
        content: 'A new AI-powered tax software is helping accounting firms reduce preparation time by 60% while improving accuracy. The tool uses machine learning to identify deductions and flag potential issues before filing.'
      },
      {
        headline: 'AICPA Issues New Guidelines on AI Use in Auditing',
        content: 'The American Institute of CPAs released comprehensive guidelines for using artificial intelligence in audit procedures, emphasizing the need for human oversight and validation of AI-generated insights.'
      },
      {
        headline: 'Cloud Accounting Platform Adds Real-Time Anomaly Detection',
        content: 'QuickBooks announced a new feature that uses AI to detect unusual transactions in real-time, alerting accountants to potential fraud or errors before they become major issues.'
      },
      {
        headline: 'Study Shows 78% of Accounting Firms Plan AI Adoption',
        content: 'A recent survey reveals that the majority of accounting firms are planning to adopt AI tools within the next 18 months, primarily for automation of routine tasks and enhanced data analysis.'
      },
      {
        headline: 'New IRS Ruling Addresses AI-Generated Tax Forms',
        content: 'The Internal Revenue Service has issued guidance on the use of AI-generated tax documents, clarifying requirements for review and validation by licensed professionals.'
      }
    ]

    const prompt = await AI_PROMPTS.welcomeSection(testArticles)
    console.log('[TEST] Prompt length:', typeof prompt === 'string' ? prompt.length : 'structured prompt')

    const response = await callOpenAI(prompt, 300, 0.8)

    results.welcomeSection = {
      success: true,
      response,
      prompt_length: typeof prompt === 'string' ? prompt.length : 'N/A (structured)',
      prompt_preview: typeof prompt === 'string' ? prompt.substring(0, 500) + '...' : 'Structured JSON prompt',
      test_articles_count: testArticles.length
    }
  } catch (error) {
    results.welcomeSection = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

#### 6.3 Database Prompt Insert (Updated with proper description format)

**Run this SQL to add the prompt:**

```sql
INSERT INTO app_settings (key, value, description)
VALUES (
  'ai_prompt_welcome_section',
  'You are writing a welcoming introduction for a local St. Cloud, Minnesota newsletter.

STYLE:
- Conversational and friendly tone
- Start with "Hey, [Audience]!" (use appropriate audience name)
- Include tagline (e.g., "Welcome back to Central Minnesota''s #1 local news newsletter.")
- Weave in 3-5 key stories from today''s newsletter in a flowing, natural sentence
- Natural, engaging language that creates curiosity
- End smoothly (no abrupt cutoffs)

GUIDELINES:
- Use "Today, we''ve got..." or "Today, we''re covering..." or "Today, we''re taking a look at..." format
- Connect stories with commas and "and" for the last item
- Each story should be a brief phrase (not full headlines)
- Focus on the most interesting angle of each story
- Keep total length to 3-4 sentences
- Select the most compelling/newsworthy stories to highlight

ARTICLES TO SUMMARIZE (Primary and Secondary):
{{articles}}

Return ONLY the welcome text (no additional formatting or explanation).',
  'General - Welcome Section: Generates newsletter introduction based on all selected articles'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
```

---

## Testing Checklist

### Database & Setup
- [ ] Database migration runs successfully (welcome_section column added)
- [ ] AI prompt inserted into app_settings table
- [ ] Prompt appears on Settings > AI Prompts page

### Prompt Testing (Settings Page)
- [ ] Welcome Section prompt can be edited in Settings
- [ ] Test Prompt button works for welcome section
- [ ] Test generates appropriate conversational welcome text
- [ ] Prompt correctly uses ALL primary AND secondary articles
- [ ] Save as Default works
- [ ] Reset to Default works

### Email Generation
- [ ] Welcome section appears in newsletter preview
- [ ] Welcome section appears as FIRST section in sent email (after header)
- [ ] Welcome section respects brand colors
- [ ] Empty welcome section doesn't break email template

### Auto-Regeneration
- [ ] Welcome generates at end of RSS processing
- [ ] Welcome regenerates when articles are toggled active/inactive
- [ ] Welcome regenerates when article order changes
- [ ] Manual "Regenerate" button works on campaign review page

### Content Quality
- [ ] Welcome text is conversational and engaging (3-4 sentences)
- [ ] Lists 3-5 key stories in natural flowing sentence
- [ ] No boring summaries - focuses on intrigue
- [ ] Appropriate audience greeting (e.g., "Hey, Accounting Pros!")
- [ ] Includes tagline

---

## File Checklist

### Files to Create:
- [ ] `db/migrations/add_welcome_section.sql` - Add welcome_section column
- [ ] `src/app/api/campaigns/[id]/regenerate-welcome/route.ts` - API for regenerating welcome

### Files to Modify:
- [ ] `src/lib/openai.ts` - Add welcomeSection prompt function (fetches ALL primary + secondary articles)
- [ ] `src/lib/rss-processor.ts` - Add generateWelcomeSection function (calls after finalize)
- [ ] `src/lib/newsletter-templates.ts` - Add generateWelcomeSection HTML template
- [ ] `src/app/dashboard/[slug]/campaigns/[id]/page.tsx` - Add welcome section UI with regenerate button
- [ ] `src/app/dashboard/[slug]/settings/page.tsx` - Add 'ai_prompt_welcome_section' to promptTypeMap
- [ ] `src/app/api/debug/test-ai-prompts/route.ts` - Add welcomeSection test handler
- [ ] Database: Run SQL to insert prompt into `app_settings` table

---

## Notes

- The welcome section should be **conversational and engaging**
- Keep it **short** (3-4 sentences max)
- Focus on **curiosity and intrigue** rather than boring summaries
- Use **natural language flow** when listing articles
- Should adapt to the **newsletter's audience** (AI Accounting Daily vs AI Enthusiasts)

---

## Example Output for AI Accounting Daily

```
Hey, Accounting Pros!

Welcome back to AI Accounting Daily, your #1 source for AI news in accounting.

Today, we're covering how Intuit's new AI assistant is helping CPAs save 10 hours a week, why the AICPA is warning about AI-generated audit reports, a landmark IRS ruling on AI tax software, and the accounting firm that automated 90% of their bookkeeping with Claude.
```
