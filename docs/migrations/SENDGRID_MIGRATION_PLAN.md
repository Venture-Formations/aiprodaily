# MailerLite to SendGrid Migration Plan

**Status:** Planning
**Created:** 2025-12-12
**Estimated Effort:** 20-30 hours

## Executive Summary

This document outlines the migration from MailerLite to SendGrid for the AIProDaily newsletter system. All features have confirmed parity, and the migration is viable.

---

## Phase 1: Setup & Dependencies (1 hour)

### 1.1 Install SendGrid Packages
```bash
npm install @sendgrid/mail @sendgrid/client
```

### 1.2 Environment Variables
Add to `.env` and Vercel:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
```

### 1.3 SendGrid Account Setup
- [ ] Create SendGrid account (Marketing Campaigns plan required)
- [ ] Verify sending domain (DNS records)
- [ ] Set account timezone to match current (Central Time)
- [ ] Create Unsubscribe Group for newsletters
- [ ] Create Contact Lists (equivalent to MailerLite groups):
  - Main subscriber list
  - Review list

---

## Phase 2: Create SendGridService Class (6-8 hours)

### 2.1 New File: `src/lib/sendgrid.ts`

```typescript
import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
sgClient.setApiKey(process.env.SENDGRID_API_KEY!);

export class SendGridService {
  // Campaign creation (Single Sends)
  async createReviewCampaign(issue: IssueWithEvents, forcedSubjectLine?: string): Promise<{ success: boolean; campaignId: string }>;
  async createFinalCampaign(issue: IssueWithEvents, listId: string, isSecondary?: boolean): Promise<{ success: boolean; campaignId: string }>;

  // Campaign scheduling
  async scheduleCampaign(campaignId: string, sendAt: Date): Promise<void>;

  // Metrics
  async importCampaignMetrics(issueId: string): Promise<MetricsUpdate>;

  // Subscribers
  async addContact(email: string, fields?: Record<string, any>, listIds?: string[]): Promise<void>;
  async updateContactField(email: string, fieldName: string, value: any): Promise<void>;

  // Transactional
  async sendTransactionalEmail(to: string, subject: string, html: string): Promise<void>;
}
```

### 2.2 API Endpoint Mapping

| Operation | MailerLite | SendGrid |
|-----------|------------|----------|
| Create campaign | `POST /campaigns` | `POST /v3/marketing/singlesends` |
| Schedule campaign | `POST /campaigns/{id}/schedule` | `PUT /v3/marketing/singlesends/{id}/schedule` |
| Get campaign stats | `GET /campaigns/{id}/reports` | `GET /v3/marketing/stats/singlesends/{id}` |
| Add subscriber | `POST /subscribers` | `PUT /v3/marketing/contacts` |
| Update subscriber | `PUT /subscribers/{id}` | `PUT /v3/marketing/contacts` |
| Add to list | `POST /subscribers/{id}/groups/{groupId}` | Include `list_ids` in contact upsert |
| Send transactional | `POST /emails` | `sgMail.send()` |

### 2.3 Timezone Handling

**Critical Change:** MailerLite uses per-request timezone IDs. SendGrid uses account-level timezone + ISO 8601 datetime.

**Current (MailerLite):**
```typescript
{
  delivery: 'scheduled',
  schedule: {
    date: '2025-01-15',
    hours: '05',
    minutes: '00',
    timezone_id: 157  // Central Time
  }
}
```

**New (SendGrid):**
```typescript
{
  send_at: '2025-01-15T05:00:00-06:00'  // ISO 8601 with offset
}
```

**Helper function needed:**
```typescript
function toSendGridSchedule(date: string, time: string, timezoneOffset: string): string {
  // Convert "2025-01-15" + "05:00" + "-06:00" to ISO 8601
  return `${date}T${time}:00${timezoneOffset}`;
}
```

---

## Phase 3: Update Newsletter Templates (2 hours)

### 3.1 Tag Replacements

**File:** `src/lib/newsletter-templates.ts`

| Location | Current (MailerLite) | New (SendGrid) |
|----------|---------------------|----------------|
| Line 242 | `{$url}` | `{{Weblink}}` |
| Line 244 | `{$forward}` | Custom tracking link (or remove) |
| Line 1357 | `{$unsubscribe}` | `[Unsubscribe]` |

### 3.2 Code Changes

```typescript
// Before (MailerLite)
<a href="{$url}" style="...">View Online</a>
<a href="{$forward}" style="...">Share</a>
<a href="{$unsubscribe}" style="...">Unsubscribe</a>

// After (SendGrid)
<a href="{{Weblink}}" style="...">View Online</a>
<!-- Remove or replace with custom share link -->
<a href="[Unsubscribe]" style="...">Unsubscribe</a>
```

### 3.3 Forward/Share Alternative
SendGrid doesn't have a built-in forward tag. Options:
1. Remove the Share link
2. Use a custom "mailto:" link
3. Use a social sharing service

---

## Phase 4: Migrate Subscriber Management (3-4 hours)

### 4.1 Subscribe Endpoint
**File:** `src/app/api/subscribe/route.ts`

**Current MailerLite flow:**
1. POST `/subscribers` to create
2. POST `/subscribers/{id}/groups/{groupId}` to add to list

**New SendGrid flow:**
```typescript
// Single upsert with list assignment
await sgClient.request({
  method: 'PUT',
  url: '/v3/marketing/contacts',
  body: {
    list_ids: [listId],
    contacts: [{
      email: email,
      first_name: name,
      custom_fields: {
        fbp: fbpValue,
        fbc: fbcValue,
        // ... other fields
      }
    }]
  }
});
```

### 4.2 Custom Fields Setup
Create these custom fields in SendGrid before migration:
- `clicked_ad` (Text)
- `clicked_ai_app` (Text)
- `poll_responses` (Number)
- `fbp` (Text) - Facebook Pixel
- `fbc` (Text) - Facebook Click ID

### 4.3 Field Update Queue
**File:** `src/app/api/cron/process-mailerlite-updates/route.ts`

Rename to: `src/app/api/cron/process-sendgrid-updates/route.ts`

Update the processing logic to use SendGrid's contact update API.

---

## Phase 5: Migrate Campaign Creation & Scheduling (6-8 hours)

### 5.1 Single Send Creation

**Current (MailerLite):**
```typescript
const campaignData = {
  name: `Newsletter: ${issue.date}`,
  type: 'regular',
  emails: [{
    subject: `${emoji} ${subjectLine}`,
    from_name: senderName,
    from: fromEmail,
    content: emailContent,
  }],
  groups: [groupId]
};
await mailerliteClient.post('/campaigns', campaignData);
```

**New (SendGrid):**
```typescript
const singleSendData = {
  name: `Newsletter: ${issue.date}`,
  send_to: {
    list_ids: [listId]
  },
  email_config: {
    subject: `${emoji} ${subjectLine}`,
    sender_id: senderId,  // Pre-configured sender identity
    html_content: emailContent,
    suppression_group_id: unsubscribeGroupId
  }
};

const [response] = await sgClient.request({
  method: 'POST',
  url: '/v3/marketing/singlesends',
  body: singleSendData
});
```

### 5.2 Campaign Scheduling

**Current (MailerLite):**
```typescript
await mailerliteClient.post(`/campaigns/${campaignId}/schedule`, {
  delivery: 'scheduled',
  schedule: { date, hours, minutes, timezone_id }
});
```

**New (SendGrid):**
```typescript
await sgClient.request({
  method: 'PUT',
  url: `/v3/marketing/singlesends/${campaignId}/schedule`,
  body: {
    send_at: '2025-01-15T05:00:00-06:00'  // ISO 8601
  }
});
```

### 5.3 Files to Update
- `src/lib/mailerlite.ts` → `src/lib/sendgrid.ts` (rewrite)
- `src/app/api/cron/send-review/route.ts` (update imports/calls)
- `src/app/api/cron/send-final/route.ts` (update imports/calls)
- `src/app/api/campaigns/[id]/send-review/route.ts`
- `src/app/api/campaigns/[id]/send-final/route.ts`

---

## Phase 6: Migrate Metrics Import - HYBRID APPROACH (3-4 hours)

### 6.1 Hybrid Strategy

**Keep MailerLite for historical lookups, use SendGrid for new campaigns.**

The system will:
1. Check if `sendgrid_singlesend_id` exists → fetch from SendGrid
2. Else if `mailerlite_campaign_id` exists → fetch from MailerLite (legacy)
3. Else → skip (no campaign ID)

### 6.2 Database Schema Change

```sql
-- Add SendGrid column alongside existing MailerLite column
ALTER TABLE email_metrics
ADD COLUMN sendgrid_singlesend_id TEXT;

-- Keep mailerlite_campaign_id for historical data
-- DO NOT rename or remove it
```

**Result:** `email_metrics` table will have both:
- `mailerlite_campaign_id` - for pre-migration campaigns
- `sendgrid_singlesend_id` - for post-migration campaigns

### 6.3 Hybrid Metrics Service

```typescript
// src/lib/email-metrics.ts

import { MailerLiteService } from './mailerlite';
import { SendGridService } from './sendgrid';

export class EmailMetricsService {
  private mailerlite: MailerLiteService;
  private sendgrid: SendGridService;

  async importMetrics(issueId: string): Promise<MetricsResult> {
    const { data: metrics } = await supabaseAdmin
      .from('email_metrics')
      .select('mailerlite_campaign_id, sendgrid_singlesend_id')
      .eq('issue_id', issueId)
      .single();

    if (!metrics) {
      return { skipped: true, reason: 'No metrics record' };
    }

    // Priority: SendGrid first (new campaigns), then MailerLite (legacy)
    if (metrics.sendgrid_singlesend_id) {
      console.log(`[Metrics] Fetching from SendGrid: ${metrics.sendgrid_singlesend_id}`);
      return this.sendgrid.importCampaignMetrics(issueId, metrics.sendgrid_singlesend_id);
    }

    if (metrics.mailerlite_campaign_id) {
      console.log(`[Metrics] Fetching from MailerLite (legacy): ${metrics.mailerlite_campaign_id}`);
      return this.mailerlite.importCampaignMetrics(issueId);
    }

    return { skipped: true, reason: 'No campaign ID found' };
  }
}
```

### 6.4 SendGrid Stats API

```typescript
const [response] = await sgClient.request({
  method: 'GET',
  url: `/v3/marketing/stats/singlesends/${singlesendId}`
});

// Response structure:
{
  results: [{
    stats: {
      requests: number,
      delivered: number,
      opens: number,
      unique_opens: number,
      clicks: number,
      unique_clicks: number,
      bounces: number,
      unsubscribes: number,
      spam_reports: number
    }
  }]
}
```

### 6.5 Metrics Mapping (Both Providers)

| Our Field | MailerLite Field | SendGrid Field |
|-----------|-----------------|----------------|
| `sent_count` | `stats.sent` | `stats.requests` |
| `delivered_count` | `stats.delivered` | `stats.delivered` |
| `opened_count` | `stats.opened.count` | `stats.unique_opens` |
| `clicked_count` | `stats.clicked.count` | `stats.unique_clicks` |
| `bounced_count` | `stats.bounced` | `stats.bounces` |
| `unsubscribed_count` | `stats.unsubscribed` | `stats.unsubscribes` |
| `open_rate` | `stats.opened.rate` | Calculate: `unique_opens / delivered` |
| `click_rate` | `stats.clicked.rate` | Calculate: `unique_clicks / delivered` |

### 6.6 Files to Update
- `src/app/api/cron/import-metrics/route.ts` - Use hybrid service
- `src/lib/mailerlite.ts` - Keep for legacy metrics (read-only)
- `src/lib/sendgrid.ts` - New metrics method
- `src/lib/email-metrics.ts` - New hybrid orchestrator

### 6.7 MailerLite Retention

**Keep these MailerLite components:**
- `MAILERLITE_API_KEY` environment variable
- `mailerliteClient` axios instance (for metrics only)
- `importCampaignMetrics()` method

**Mark as legacy/deprecated:**
```typescript
// src/lib/mailerlite.ts

/**
 * @deprecated Use SendGridService for new campaigns.
 * This service is retained for historical metrics lookup only.
 */
export class MailerLiteService {
  // ... existing metrics code
}
```

---

## Phase 7: Update All API Routes (2-3 hours)

### 7.1 Routes Requiring Updates

| Route | Changes Needed |
|-------|---------------|
| `src/app/api/subscribe/route.ts` | Use SendGrid contacts API |
| `src/app/api/subscribe/personalize/route.ts` | Use SendGrid contacts API |
| `src/app/api/cron/send-review/route.ts` | Import SendGridService |
| `src/app/api/cron/send-final/route.ts` | Import SendGridService |
| `src/app/api/cron/import-metrics/route.ts` | Use SendGrid stats API |
| `src/app/api/cron/process-mailerlite-updates/route.ts` | Rename & rewrite |
| `src/app/api/analytics/[campaign]/route.ts` | Update metrics fetch |
| `src/app/api/link-tracking/click/route.ts` | Update queue table name |
| `src/app/api/polls/[id]/respond/route.ts` | Update service call |

### 7.2 Debug Endpoints to Update/Remove
- `src/app/api/debug/(tests)/test-mailerlite.ts`
- `src/app/api/debug/(tests)/test-mailerlite-campaign.ts`
- `src/app/api/debug/(tests)/test-mailerlite-review.ts`
- `src/app/api/debug/(integrations)/mailerlite-campaign-debug.ts`
- `src/app/api/debug/(checks)/check-mailerlite-campaigns.ts`

---

## Phase 8: Database Schema Updates (1-2 hours)

### 8.1 Email Metrics Table (KEEP BOTH COLUMNS)
```sql
-- Add SendGrid column (keep MailerLite for historical data)
ALTER TABLE email_metrics
ADD COLUMN sendgrid_singlesend_id TEXT;

-- Add index for new column
CREATE INDEX idx_email_metrics_sendgrid_id ON email_metrics(sendgrid_singlesend_id);

-- DO NOT remove mailerlite_campaign_id - needed for legacy metrics
```

### 8.2 Field Updates Queue (NEW TABLE)
```sql
-- Create new SendGrid queue table (keep old MailerLite table for reference)
CREATE TABLE sendgrid_field_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_email TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INT DEFAULT 0,
  error_message TEXT,
  publication_id UUID REFERENCES newsletters(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sendgrid_updates_status ON sendgrid_field_updates(status);
CREATE INDEX idx_sendgrid_updates_email ON sendgrid_field_updates(subscriber_email);
CREATE INDEX idx_sendgrid_updates_publication ON sendgrid_field_updates(publication_id);
```

### 8.3 Publication Settings Updates
**Add new SendGrid settings (keep MailerLite settings for reference):**

```sql
-- Add SendGrid-specific settings per publication
INSERT INTO publication_settings (publication_id, key, value)
SELECT publication_id, 'sendgrid_main_list_id', value
FROM publication_settings
WHERE key = 'email_mainGroupId';

INSERT INTO publication_settings (publication_id, key, value)
SELECT publication_id, 'sendgrid_review_list_id', value
FROM publication_settings
WHERE key = 'email_reviewGroupId';

-- New required settings
-- sendgrid_sender_id (configured in SendGrid UI)
-- sendgrid_unsubscribe_group_id (configured in SendGrid UI)
```

### 8.4 Settings Key Mapping

| Purpose | MailerLite Key (Keep) | SendGrid Key (Add) |
|---------|----------------------|-------------------|
| Main subscriber list | `email_mainGroupId` | `sendgrid_main_list_id` |
| Review list | `email_reviewGroupId` | `sendgrid_review_list_id` |
| Subscription form list | `mailerlite_group_id` | `sendgrid_signup_list_id` |
| Timezone | `email_timezone_id` | *(account-level)* |
| Sender identity | N/A | `sendgrid_sender_id` |
| Unsubscribe group | N/A | `sendgrid_unsubscribe_group_id` |

### 8.5 Migration Script

```sql
-- Full migration script
BEGIN;

-- 1. Add SendGrid column to email_metrics
ALTER TABLE email_metrics
ADD COLUMN IF NOT EXISTS sendgrid_singlesend_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_metrics_sendgrid_id
ON email_metrics(sendgrid_singlesend_id);

-- 2. Create SendGrid field updates queue
CREATE TABLE IF NOT EXISTS sendgrid_field_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_email TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  status TEXT DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  error_message TEXT,
  publication_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sendgrid_updates_status
ON sendgrid_field_updates(status);

COMMIT;
```

---

## Phase 9: Testing & Verification (4-6 hours)

### 9.1 Pre-Migration Testing
- [ ] Create test Single Send manually in SendGrid UI
- [ ] Verify scheduling works with timezone
- [ ] Test contact creation/update via API
- [ ] Verify custom fields work
- [ ] Test transactional email sending

### 9.2 Integration Testing
- [ ] Test subscribe flow end-to-end
- [ ] Test review campaign creation
- [ ] Test final campaign creation & scheduling
- [ ] Test metrics import
- [ ] Test field update queue processing
- [ ] Test unsubscribe link works
- [ ] Test View Online link works

### 9.3 Production Migration Checklist
- [ ] Export all MailerLite subscribers
- [ ] Import subscribers to SendGrid lists
- [ ] Map custom field data
- [ ] Verify sender identity in SendGrid
- [ ] Update DNS records if needed
- [ ] Deploy code changes
- [ ] Test with single campaign
- [ ] Monitor for 24-48 hours
- [ ] Remove MailerLite dependencies

---

## Risk Mitigation

### High Risk Areas
1. **Timezone scheduling** - Must test thoroughly
2. **Subscriber import** - Ensure no data loss
3. **Campaign ID storage** - Metrics depend on correct IDs

### Rollback Plan
1. Keep MailerLite service file for 30 days
2. Can switch back by changing imports
3. Subscriber data exists in both systems during transition

---

## Environment Variable Changes

### Keep (for legacy metrics)
```env
MAILERLITE_API_KEY=xxx  # Required for historical campaign metrics lookup
```

### Add
```env
SENDGRID_API_KEY=SG.xxx
```

**Note:** `SENDGRID_UNSUBSCRIBE_GROUP_ID` and `SENDGRID_SENDER_ID` are stored in `publication_settings` table for multi-tenant support, not as environment variables.

---

## Dependencies to Update

### Remove
```json
// package.json - no explicit MailerLite package (uses axios)
```

### Add
```json
{
  "@sendgrid/mail": "^8.x",
  "@sendgrid/client": "^8.x"
}
```

---

## Timeline Summary

| Phase | Estimated Hours |
|-------|----------------|
| Phase 1: Setup | 1 |
| Phase 2: SendGrid Service | 6-8 |
| Phase 3: Templates | 2 |
| Phase 4: Subscribers | 3-4 |
| Phase 5: Campaigns | 6-8 |
| Phase 6: Metrics | 3-4 |
| Phase 7: API Routes | 2-3 |
| Phase 8: Database | 1-2 |
| Phase 9: Testing | 4-6 |
| **Total** | **28-38 hours** |

---

## Sources
- [SendGrid Weblink Documentation](https://www.twilio.com/docs/sendgrid/ui/sending-email/weblink)
- [SendGrid Substitution Tags](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/substitution-tags)
- [SendGrid Marketing Campaigns Stats](https://docs.sendgrid.com/ui/analytics-and-reporting/marketing-campaigns-stats-overview)
- [SendGrid Contacts API](https://docs.sendgrid.com/ui/managing-contacts/create-and-manage-contacts)
- [SendGrid Custom Fields](https://docs.sendgrid.com/ui/managing-contacts/custom-fields)
- [SendGrid Scheduling Email](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/scheduling-email)
