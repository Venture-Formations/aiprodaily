-- Add show_name toggle to all module tables (defaults to true = show header)
-- text_box_modules and feedback_modules already have this column

ALTER TABLE article_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
ALTER TABLE ad_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
ALTER TABLE ai_app_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
ALTER TABLE prompt_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
ALTER TABLE poll_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
ALTER TABLE sparkloop_rec_modules ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true;
