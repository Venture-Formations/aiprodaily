/**
 * Column Validation Tests
 *
 * Validates that every *_COLS constant string references only real database columns.
 * This catches typos like `times_shown` instead of `times_used` at build time,
 * preventing 500 errors in production.
 *
 * Valid column sets are derived from TypeScript interfaces in src/types/database.ts
 * plus known DB-only columns not reflected in TS interfaces.
 */
import { describe, test, expect } from 'vitest'

// --- Import COLS constants from their source files ---
import { ISSUE_COLUMNS, ISSUE_COLUMNS_BRIEF } from '@/lib/dal/issues'
import { EVENT_COLS, ISSUE_EVENT_COLS } from '@/lib/rss-processor/utils'
import {
  NEWSLETTER_SECTION_COLS,
  AD_MODULE_COLS,
  POLL_MODULE_COLS,
  PROMPT_MODULE_COLS,
  ARTICLE_MODULE_COLS,
  TEXT_BOX_MODULE_COLS,
  TEXT_BOX_BLOCK_COLS,
  FEEDBACK_MODULE_COLS,
} from '@/lib/newsletter-templates/build-snapshot'
import { APP_COLS, PROMPT_COLS, SECTION_COLS } from '@/lib/column-constants'

// --- Helper ---

/** Split a comma-separated column string into trimmed column names */
function parseColumns(colString: string): string[] {
  return colString
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

// --- Valid column sets per table ---
// Derived from TypeScript interfaces in src/types/database.ts.
// DB-only columns (present in migrations but not in TS interfaces) are noted inline.

const VALID_COLUMNS: Record<string, Set<string>> = {
  ai_applications: new Set([
    'id', 'publication_id', 'app_name', 'tagline', 'description', 'category',
    'app_url', 'tracked_link', 'logo_url', 'logo_alt', 'screenshot_url', 'screenshot_alt',
    'tool_type', 'category_priority', 'is_featured', 'is_paid_placement', 'is_affiliate',
    'is_active', 'display_order', 'last_used_date', 'times_used', 'created_at', 'updated_at',
    'clerk_user_id', 'submitter_email', 'submitter_name', 'submitter_image_url',
    'submission_status', 'rejection_reason', 'approved_by', 'approved_at',
    'plan', 'stripe_payment_id', 'stripe_subscription_id', 'stripe_customer_id',
    'sponsor_start_date', 'sponsor_end_date', 'view_count', 'click_count',
    'ai_app_module_id', 'priority', 'pinned_position', 'button_text',
  ]),

  prompt_ideas: new Set([
    'id', 'publication_id', 'title', 'prompt_text', 'category', 'use_case',
    'suggested_model', 'difficulty_level', 'estimated_time', 'is_featured', 'is_active',
    'display_order', 'last_used_date', 'times_used', 'prompt_module_id', 'priority',
    'created_at', 'updated_at',
  ]),

  // NewsletterSection TS interface is minimal; newsletter_id and description are DB-only columns
  newsletter_sections: new Set([
    'id', 'newsletter_id', 'name', 'display_order', 'is_active', 'section_type',
    'description', 'created_at',
  ]),

  publication_issues: new Set([
    'id', 'publication_id', 'date', 'status',
    'subject_line', 'welcome_intro', 'welcome_tagline', 'welcome_summary',
    'review_sent_at', 'final_sent_at',
    'last_action', 'last_action_at', 'last_action_by',
    'status_before_send', 'metrics',
    'workflow_state', 'workflow_state_started_at', 'workflow_error',
    'poll_id', 'poll_snapshot',
    'mailerlite_issue_id', 'failure_alerted_at',
    'created_at', 'updated_at',
  ]),

  events: new Set([
    'id', 'external_id', 'title', 'description', 'event_summary',
    'start_date', 'end_date', 'venue', 'address', 'url', 'website',
    'image_url', 'original_image_url', 'cropped_image_url',
    'featured', 'paid_placement', 'active',
    'submission_status', 'payment_status', 'payment_intent_id', 'payment_amount',
    'submitter_name', 'submitter_email', 'submitter_phone',
    'reviewed_by', 'reviewed_at', 'raw_data',
    'created_at', 'updated_at',
  ]),

  issue_events: new Set([
    'id', 'issue_id', 'event_id', 'event_date',
    'is_selected', 'is_featured', 'display_order', 'created_at',
  ]),

  ad_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'selection_mode', 'block_order', 'config', 'next_position',
    'created_at', 'updated_at',
  ]),

  poll_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'block_order', 'config', 'created_at', 'updated_at',
  ]),

  prompt_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'selection_mode', 'block_order', 'config', 'next_position',
    'created_at', 'updated_at',
  ]),

  article_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'selection_mode', 'block_order', 'config',
    'articles_count', 'lookback_hours', 'ai_image_prompt',
    'created_at', 'updated_at',
  ]),

  text_box_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'show_name', 'config', 'created_at', 'updated_at',
  ]),

  text_box_blocks: new Set([
    'id', 'text_box_module_id', 'block_type', 'display_order',
    'static_content', 'text_size', 'ai_prompt_json', 'generation_timing',
    'image_type', 'static_image_url', 'ai_image_prompt', 'image_alt',
    'is_active', 'is_bold', 'is_italic',
    'created_at', 'updated_at',
  ]),

  feedback_modules: new Set([
    'id', 'publication_id', 'name', 'display_order', 'is_active',
    'show_name', 'config', 'created_at', 'updated_at',
    // Legacy fields (still present in DB and used by FEEDBACK_MODULE_COLS)
    'block_order', 'title_text', 'body_text', 'body_is_italic',
    'sign_off_text', 'sign_off_is_italic', 'vote_options', 'team_photos',
  ]),
}

// --- Tests ---

describe('Column validation: COLS constants match database schema', () => {
  // Helper to run a single column validation
  function expectColumnsValid(
    constantName: string,
    colString: string,
    tableName: string
  ) {
    test(`${constantName} matches ${tableName} table`, () => {
      const cols = parseColumns(colString)
      const validSet = VALID_COLUMNS[tableName]

      expect(validSet).toBeDefined()
      expect(cols.length).toBeGreaterThan(0)

      const invalid = cols.filter((c) => !validSet!.has(c))
      if (invalid.length > 0) {
        // Provide a helpful error message
        expect(invalid).toEqual(
          expect.objectContaining({
            length: 0,
          })
        )
      }
      expect(invalid).toEqual([])
    })
  }

  // ai_applications
  expectColumnsValid('APP_COLS', APP_COLS, 'ai_applications')

  // prompt_ideas
  expectColumnsValid('PROMPT_COLS', PROMPT_COLS, 'prompt_ideas')

  // newsletter_sections (from settings route)
  expectColumnsValid('SECTION_COLS', SECTION_COLS, 'newsletter_sections')

  // publication_issues
  expectColumnsValid('ISSUE_COLUMNS', ISSUE_COLUMNS, 'publication_issues')
  expectColumnsValid('ISSUE_COLUMNS_BRIEF', ISSUE_COLUMNS_BRIEF, 'publication_issues')

  // events
  expectColumnsValid('EVENT_COLS', EVENT_COLS, 'events')

  // issue_events
  expectColumnsValid('ISSUE_EVENT_COLS', ISSUE_EVENT_COLS, 'issue_events')

  // Module config tables (from build-snapshot.ts)
  expectColumnsValid('NEWSLETTER_SECTION_COLS', NEWSLETTER_SECTION_COLS, 'newsletter_sections')
  expectColumnsValid('AD_MODULE_COLS', AD_MODULE_COLS, 'ad_modules')
  expectColumnsValid('POLL_MODULE_COLS', POLL_MODULE_COLS, 'poll_modules')
  expectColumnsValid('PROMPT_MODULE_COLS', PROMPT_MODULE_COLS, 'prompt_modules')
  expectColumnsValid('ARTICLE_MODULE_COLS', ARTICLE_MODULE_COLS, 'article_modules')
  expectColumnsValid('TEXT_BOX_MODULE_COLS', TEXT_BOX_MODULE_COLS, 'text_box_modules')
  expectColumnsValid('TEXT_BOX_BLOCK_COLS', TEXT_BOX_BLOCK_COLS, 'text_box_blocks')
  expectColumnsValid('FEEDBACK_MODULE_COLS', FEEDBACK_MODULE_COLS, 'feedback_modules')
})
