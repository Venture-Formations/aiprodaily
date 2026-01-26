-- Add is_bold column to text_box_blocks for AI Prompt blocks
-- When true, the entire AI-generated content will be rendered in bold

ALTER TABLE text_box_blocks
ADD COLUMN IF NOT EXISTS is_bold BOOLEAN DEFAULT false;

COMMENT ON COLUMN text_box_blocks.is_bold IS 'When true, renders the AI prompt block content in bold (applies to ai_prompt blocks)';
