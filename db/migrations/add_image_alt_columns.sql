-- Add image_alt columns for accessible alt text on newsletter images
-- Each column is VARCHAR(200) to enforce a reasonable alt text length

-- Article source images (RSS posts)
ALTER TABLE rss_posts ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- Article AI images and module articles
ALTER TABLE module_articles ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- Advertisement images (legacy advertorial system)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- Text box block images (static and AI-generated)
ALTER TABLE text_box_blocks ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- Per-issue text box block images (overrides)
ALTER TABLE issue_text_box_blocks ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- Poll images
ALTER TABLE polls ADD COLUMN IF NOT EXISTS image_alt VARCHAR(200);

-- AI application logos and screenshots
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS logo_alt VARCHAR(200);
ALTER TABLE ai_applications ADD COLUMN IF NOT EXISTS screenshot_alt VARCHAR(200);
