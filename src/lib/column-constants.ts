/**
 * Shared column-list constants for Supabase queries.
 *
 * Extracted here so both API route files (which cannot export custom names)
 * and the column-validation test can reference the same strings.
 */

// ai_applications columns used by /api/ai-apps
export const APP_COLS = 'id, publication_id, app_name, tagline, description, category, app_url, logo_url, logo_alt, screenshot_url, screenshot_alt, tool_type, category_priority, pinned_position, is_active, is_featured, is_paid_placement, is_affiliate, ai_app_module_id, times_used, last_used_date, created_at, updated_at'

// prompt_ideas columns used by /api/prompt-ideas
export const PROMPT_COLS = 'id, publication_id, prompt_module_id, title, prompt_text, category, use_case, suggested_model, difficulty_level, is_featured, is_active, display_order, priority, times_used, created_at, updated_at'

// newsletter_sections columns used by /api/settings/newsletter-sections
export const SECTION_COLS = 'id, newsletter_id, name, display_order, is_active, section_type, description, created_at'
