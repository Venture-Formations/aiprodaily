# Provision a New Publication

_Last updated: 2026-02-26_

Step-by-step checklist for creating a new publication. Each section maps to a phase in the automation script (`scripts/provision-publication.ts`).

**Automated:** `npm run provision-publication` handles Phases 1-4 interactively.

---

## Phase 1: Create Publication Row

Insert into `publications`:

| Column | Value | Notes |
|--------|-------|-------|
| `name` | Publication display name | e.g. "AI Pros Daily" |
| `slug` | Lowercase, hyphenated | Must be unique |
| `subdomain` | Subdomain string | Usually matches slug |
| `website_domain` | e.g. `aiprodaily.com` | Optional; used for public site routing |
| `primary_color` | Hex color | Default: `#1C293D` |
| `is_active` | `true` | |

```sql
INSERT INTO publications (name, slug, subdomain, website_domain, primary_color, is_active)
VALUES ('My Newsletter', 'my-newsletter', 'my-newsletter', 'mynewsletter.com', '#1C293D', true)
RETURNING id;
```

Save the returned `id` — it's the `publication_id` for all subsequent inserts.

---

## Phase 2: Publication Settings (~50 rows)

Insert into `publication_settings` with `(publication_id, key, value)`. Grouped by category:

### Branding (12 keys)
| Key | Default | Notes |
|-----|---------|-------|
| `newsletter_name` | Publication name | |
| `business_name` | Publication name | |
| `primary_color` | `#1C293D` | |
| `secondary_color` | `#10B981` | |
| `tertiary_color` | `#F59E0B` | |
| `quaternary_color` | `#8B5CF6` | |
| `heading_font` | `Arial, sans-serif` | |
| `body_font` | `Arial, sans-serif` | |
| `website_url` | `https://yourdomain.com` | |
| `contact_email` | Your email | |
| `logo_url` | (blank) | Set after uploading logo |
| `header_image_url` | (blank) | Set after uploading header |

### Social (8 keys)
| Key | Default |
|-----|---------|
| `facebook_enabled` | `false` |
| `facebook_url` | (blank) |
| `twitter_enabled` | `false` |
| `twitter_url` | (blank) |
| `linkedin_enabled` | `false` |
| `linkedin_url` | (blank) |
| `instagram_enabled` | `false` |
| `instagram_url` | (blank) |

### Email Provider (4 keys)
| Key | Default | Notes |
|-----|---------|-------|
| `email_provider` | `mailerlite` | Or `sendgrid` |
| `email_senderName` | Publication name | |
| `email_fromEmail` | Contact email | |
| `subject_line_emoji` | (blank) | Optional emoji prefix |

### MailerLite Groups (4 keys)
| Key | Default | Notes |
|-----|---------|-------|
| `mailerlite_main_group_id` | (blank) | Set after creating group in ML |
| `mailerlite_review_group_id` | (blank) | Set after creating group in ML |
| `mailerlite_test_group_id` | (blank) | Set after creating group in ML |
| `mailerlite_signup_group_id` | (blank) | Set after creating group in ML |

### Schedule (12 keys)
All schedules disabled by default. See `src/lib/settings/schedule-settings.ts` for `DB_KEY_MAP`.

| Key | Default | Notes |
|-----|---------|-------|
| `email_reviewScheduleEnabled` | `false` | Enable when ready |
| `email_dailyScheduleEnabled` | `false` | Enable when ready |
| `email_rssProcessingTime` | `20:30` | |
| `email_issueCreationTime` | `20:50` | |
| `email_scheduledSendTime` | `21:00` | |
| `email_dailyissueCreationTime` | `04:30` | Note: lowercase `i` is intentional |
| `email_dailyScheduledSendTime` | `04:55` | |
| `email_timezone_id` | `157` | US Eastern; see `timezones` table |
| `email_secondaryScheduleEnabled` | `false` | |
| `email_secondaryissueCreationTime` | `06:00` | |
| `email_secondaryScheduledSendTime` | `06:30` | |
| `secondary_send_days` | `[]` | JSON array of day numbers (0=Sun) |

### Article Processing (7 keys)
| Key | Default |
|-----|---------|
| `primary_article_lookback_hours` | `72` |
| `secondary_article_lookback_hours` | `168` |
| `max_top_articles` | `3` |
| `max_bottom_articles` | `3` |
| `max_secondary_articles` | `3` |
| `dedup_historical_lookback_days` | `30` |
| `dedup_strictness_threshold` | `0.85` |

### AI Apps (3 keys)
| Key | Default |
|-----|---------|
| `ai_apps_per_newsletter` | `6` |
| `ai_apps_max_per_category` | `3` |
| `affiliate_cooldown_days` | `7` |

### Misc (3 keys)
| Key | Default |
|-----|---------|
| `next_ad_position` | `1` |
| `excluded_rss_sources` | `[]` |
| `blocked_domains` | `[]` |

---

## Phase 3: Article Module Setup

### 3a. article_modules (1 row)
| Column | Value |
|--------|-------|
| `publication_id` | Your publication ID |
| `name` | `Top Stories` |
| `display_order` | `10` |
| `is_active` | `true` |
| `selection_mode` | `top_score` |
| `block_order` | `["source_image", "title", "body"]` |
| `articles_count` | `3` |
| `lookback_hours` | `72` |

### 3b. article_module_criteria (4 rows)
| criteria_number | name | weight |
|-----------------|------|--------|
| 1 | Relevance | 0.30 |
| 2 | Timeliness | 0.25 |
| 3 | Impact | 0.25 |
| 4 | Novelty | 0.20 |

Each row needs `article_module_id` from 3a, `is_active = true`, and an `ai_prompt` for scoring.

### 3c. article_module_prompts (2 rows)
| prompt_type | ai_prompt |
|-------------|-----------|
| `article_title` | Write a concise, engaging newsletter headline. Keep under 80 chars. |
| `article_body` | Write a 2-3 sentence newsletter summary. Be informative and engaging. |

---

## Phase 4: Content Modules

### 4a. prompt_modules (1 row)
| Column | Value |
|--------|-------|
| `publication_id` | Your publication ID |
| `name` | `Prompt of the Day` |
| `display_order` | `20` |
| `selection_mode` | `random` |
| `block_order` | `["title", "body"]` |

### 4b. ai_app_modules (1 row)
| Column | Value |
|--------|-------|
| `publication_id` | Your publication ID |
| `name` | `AI Applications` |
| `display_order` | `30` |
| `selection_mode` | `affiliate_priority` |
| `block_order` | `["title", "description", "button"]` |
| `apps_count` | `6` |
| `max_per_category` | `3` |
| `affiliate_cooldown_days` | `7` |

### 4c. text_box_modules + text_box_blocks (Welcome section)
Module:
| Column | Value |
|--------|-------|
| `publication_id` | Your publication ID |
| `name` | `Welcome` |
| `display_order` | `5` |
| `show_name` | `false` |

Block (1 row):
| Column | Value |
|--------|-------|
| `text_box_module_id` | Module ID from above |
| `block_type` | `static_text` |
| `display_order` | `0` |
| `static_content` | Placeholder welcome text |

### 4d. feedback_modules (1 row)
| Column | Value |
|--------|-------|
| `publication_id` | Your publication ID |
| `name` | `Feedback` |
| `display_order` | `999` |
| `title_text` | `That's it for today!` |
| `sign_off_text` | `See you tomorrow!` |
| `vote_options` | `[{"emoji":"star","label":"Nailed it","value":5},...]` |

---

## Phase 5: Post-Provisioning (Manual)

These steps must be done manually after running the script:

### 5a. MailerLite Groups
1. Create groups in MailerLite dashboard: Main, Review, Test, Signup
2. Copy group IDs and update `publication_settings`:
   - `mailerlite_main_group_id`
   - `mailerlite_review_group_id`
   - `mailerlite_test_group_id`
   - `mailerlite_signup_group_id`

### 5b. RSS Feeds
Add feeds to `rss_feeds` table:
```sql
INSERT INTO rss_feeds (publication_id, url, name, active, use_for_primary_section)
VALUES ('<pub_id>', 'https://example.com/feed', 'Example Feed', true, true);
```

### 5c. Images
1. Upload logo and header images (GitHub or CDN)
2. Update `logo_url` and `header_image_url` in `publication_settings`

### 5d. Content Pool
- Add rows to `prompt_ideas` for Prompt of the Day
- Add rows to `ai_applications` for AI app features

### 5e. Enable Schedules
When ready to go live, update:
```sql
UPDATE publication_settings SET value = 'true'
WHERE publication_id = '<pub_id>'
  AND key IN ('email_reviewScheduleEnabled', 'email_dailyScheduleEnabled');
```

### 5f. Customize Prompts
- Update `article_module_criteria` AI prompts for your audience
- Optionally add per-tenant AI prompts to `publication_settings` (keys prefixed `ai_prompt_`)

---

## Verification Queries

Confirm row counts after provisioning:

```sql
-- Publication exists
SELECT id, name, slug FROM publications WHERE slug = '<slug>';

-- Settings count (should be ~53)
SELECT COUNT(*) FROM publication_settings WHERE publication_id = '<pub_id>';

-- Module counts
SELECT 'article_modules' AS t, COUNT(*) FROM article_modules WHERE publication_id = '<pub_id>'
UNION ALL SELECT 'article_module_criteria', COUNT(*) FROM article_module_criteria WHERE article_module_id IN (SELECT id FROM article_modules WHERE publication_id = '<pub_id>')
UNION ALL SELECT 'article_module_prompts', COUNT(*) FROM article_module_prompts WHERE article_module_id IN (SELECT id FROM article_modules WHERE publication_id = '<pub_id>')
UNION ALL SELECT 'prompt_modules', COUNT(*) FROM prompt_modules WHERE publication_id = '<pub_id>'
UNION ALL SELECT 'ai_app_modules', COUNT(*) FROM ai_app_modules WHERE publication_id = '<pub_id>'
UNION ALL SELECT 'text_box_modules', COUNT(*) FROM text_box_modules WHERE publication_id = '<pub_id>'
UNION ALL SELECT 'feedback_modules', COUNT(*) FROM feedback_modules WHERE publication_id = '<pub_id>';
```

Expected: 1 article module, 4 criteria, 2 prompts, 1 prompt module, 1 AI app module, 1 text box module, 1 feedback module.
