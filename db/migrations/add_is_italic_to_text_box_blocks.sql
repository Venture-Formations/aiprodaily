-- Add is_italic column to text_box_blocks for text styling
-- When true, the entire block content will be rendered in italic

ALTER TABLE text_box_blocks
ADD COLUMN IF NOT EXISTS is_italic BOOLEAN DEFAULT false;

COMMENT ON COLUMN text_box_blocks.is_italic IS 'When true, renders the block content in italic (can be combined with is_bold)';
