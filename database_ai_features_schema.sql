-- ============================================
-- AI PROFESSIONAL NEWSLETTER - AI FEATURES SCHEMA
-- ============================================
-- Created: 2025-10-13
-- Purpose: AI Applications and Prompt Ideas for profession-specific newsletters

-- ============================================
-- 1. AI APPLICATIONS TABLE
-- ============================================

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
  tracked_link TEXT, -- MailerLite tracked link (generated later)
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
CREATE INDEX idx_ai_apps_last_used ON ai_applications(last_used_date);

-- ============================================
-- 2. CAMPAIGN AI APP SELECTIONS TABLE
-- ============================================

CREATE TABLE campaign_ai_app_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES ai_applications(id) ON DELETE CASCADE,
  selection_order INT NOT NULL, -- 1-5 for display position
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, app_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_apps_campaign ON campaign_ai_app_selections(campaign_id);
CREATE INDEX idx_campaign_apps_app ON campaign_ai_app_selections(app_id);

-- ============================================
-- 3. PROMPT IDEAS TABLE
-- ============================================

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
CREATE INDEX idx_prompt_ideas_last_used ON prompt_ideas(last_used_date);

-- ============================================
-- 4. CAMPAIGN PROMPT SELECTIONS TABLE
-- ============================================

CREATE TABLE campaign_prompt_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompt_ideas(id) ON DELETE CASCADE,
  selection_order INT NOT NULL, -- 1-5 for display position
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, prompt_id),
  UNIQUE(campaign_id, selection_order)
);

CREATE INDEX idx_campaign_prompts_campaign ON campaign_prompt_selections(campaign_id);
CREATE INDEX idx_campaign_prompts_prompt ON campaign_prompt_selections(prompt_id);

-- ============================================
-- 5. SAMPLE DATA - ACCOUNTING NEWSLETTER
-- ============================================

-- Insert sample AI applications for Accounting newsletter
INSERT INTO ai_applications (newsletter_id, app_name, tagline, description, category, app_url, pricing) VALUES
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'QuickBooks AI Assistant',
  'Automate your bookkeeping with AI',
  'AI-powered accounting assistant that categorizes transactions, detects anomalies, and generates financial reports automatically.',
  'Automation',
  'https://quickbooks.intuit.com/ai',
  'Freemium'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'TaxGPT',
  'AI tax advisor for complex scenarios',
  'Get instant answers to complex tax questions with AI trained on IRS publications and tax law. Includes source citations for accuracy.',
  'Tax Planning',
  'https://taxgpt.com',
  'Paid'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Receipt-AI',
  'Snap receipts, auto-categorize expenses',
  'Mobile app that uses computer vision to extract data from receipts and automatically categorizes expenses for your accounting software.',
  'Expense Tracking',
  'https://receipt-ai.com',
  'Free'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'ForecastFlow',
  'AI-powered financial forecasting',
  'Upload historical financial data and get AI-generated forecasts with scenario analysis for better business planning.',
  'Financial Planning',
  'https://forecastflow.ai',
  '$49/mo'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'AuditBot',
  'Automated compliance checking',
  'AI assistant that reviews your financial statements for common errors, compliance issues, and audit red flags before submission.',
  'Compliance',
  'https://auditbot.io',
  'Freemium'
);

-- Insert sample prompt ideas for Accounting newsletter
INSERT INTO prompt_ideas (newsletter_id, title, prompt_text, category, use_case, suggested_model, difficulty_level, estimated_time) VALUES
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Analyze Monthly Cash Flow',
  'Review the following cash flow data from [Month]: [paste data]. Identify trends, potential issues, and provide 3 actionable recommendations to improve cash flow in the next quarter.',
  'Financial Analysis',
  'Use this when reviewing monthly financials with clients to quickly identify key insights.',
  'ChatGPT',
  'Beginner',
  '2 minutes'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Draft Tax Deadline Reminder Email',
  'Write a professional email to clients reminding them of the [Tax Deadline Date] deadline. Include: 1) Required documents, 2) Consequences of missing deadline, 3) How to schedule appointment. Tone: Professional but friendly.',
  'Client Communication',
  'Save time during tax season by generating personalized reminder emails.',
  'Claude',
  'Beginner',
  '1 minute'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Explain Complex Tax Concept',
  'Explain [Tax Concept] to a small business owner with no accounting background. Use simple language, analogies, and a real-world example. Keep it under 200 words.',
  'Client Education',
  'Help clients understand complex tax topics without overwhelming them with jargon.',
  'Claude',
  'Intermediate',
  '3 minutes'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Generate Financial Ratio Analysis',
  'Analyze these financial ratios for [Company Name]: [paste ratios]. Compare them to industry benchmarks and identify 3 areas of concern and 2 strengths. Suggest specific actions to improve weak areas.',
  'Financial Analysis',
  'Quickly generate comprehensive ratio analysis for client presentations or internal reviews.',
  'ChatGPT',
  'Intermediate',
  '5 minutes'
),
(
  (SELECT id FROM newsletters WHERE slug = 'accounting'),
  'Create Year-End Tax Planning Checklist',
  'Create a year-end tax planning checklist for [Type of Business/Individual]. Include: 1) Income strategies, 2) Deduction opportunities, 3) Retirement contributions, 4) Important deadlines. Format as a prioritized checklist.',
  'Tax Planning',
  'Provide clients with actionable year-end planning steps tailored to their situation.',
  'ChatGPT',
  'Advanced',
  '4 minutes'
);

-- ============================================
-- 6. UPDATE NEWSLETTER SECTIONS
-- ============================================

-- Add new sections for AI Professional newsletters
INSERT INTO newsletter_sections (newsletter_id, name, display_order, is_active, description) VALUES
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Welcome', 1, true, 'Article overview section'),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Advertisement', 2, true, 'Sponsor advertisement'),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Top Articles', 3, true, 'First 3 articles from RSS feed'),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'AI Applications', 4, true, '5 AI tools for accountants'),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Bottom Articles', 5, true, 'Last 3 articles from RSS feed'),
((SELECT id FROM newsletters WHERE slug = 'accounting'), 'Prompt Ideas', 6, true, '3-5 AI prompts to try');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify tables created successfully
-- 3. Check sample data populated
-- 4. Test API endpoints for AI applications and prompt ideas
