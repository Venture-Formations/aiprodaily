-- Text Box Modules System Migration
-- Creates tables for flexible text-based newsletter sections (replaces hardcoded Welcome Section)

-- ============================================
-- Table: text_box_modules
-- Main module definitions per publication
-- ============================================
CREATE TABLE IF NOT EXISTS text_box_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  show_name BOOLEAN DEFAULT true,  -- Whether to show section header in newsletter
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for text_box_modules
CREATE INDEX IF NOT EXISTS idx_text_box_modules_publication ON text_box_modules(publication_id);
CREATE INDEX IF NOT EXISTS idx_text_box_modules_active ON text_box_modules(publication_id, is_active);
CREATE INDEX IF NOT EXISTS idx_text_box_modules_display_order ON text_box_modules(publication_id, display_order);

-- ============================================
-- Table: text_box_blocks
-- Individual blocks within each module
-- ============================================
CREATE TABLE IF NOT EXISTS text_box_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_box_module_id UUID NOT NULL REFERENCES text_box_modules(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('static_text', 'ai_prompt', 'image')),
  display_order INTEGER DEFAULT 0,

  -- Static Text Block fields
  static_content TEXT,  -- Rich HTML content from Quill editor
  text_size TEXT DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large')),

  -- AI Prompt Block fields
  ai_prompt_json JSONB,  -- Full AI prompt configuration (model, messages, etc.)
  generation_timing TEXT DEFAULT 'after_articles' CHECK (generation_timing IN ('before_articles', 'after_articles')),

  -- Image Block fields
  image_type TEXT CHECK (image_type IN ('static', 'ai_generated')),
  static_image_url TEXT,  -- URL for static uploaded images
  ai_image_prompt TEXT,  -- Prompt for AI image generation

  -- Common fields
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for text_box_blocks
CREATE INDEX IF NOT EXISTS idx_text_box_blocks_module ON text_box_blocks(text_box_module_id);
CREATE INDEX IF NOT EXISTS idx_text_box_blocks_order ON text_box_blocks(text_box_module_id, display_order);
CREATE INDEX IF NOT EXISTS idx_text_box_blocks_timing ON text_box_blocks(generation_timing) WHERE block_type = 'ai_prompt';

-- ============================================
-- Table: issue_text_box_modules
-- Per-issue module tracking
-- ============================================
CREATE TABLE IF NOT EXISTS issue_text_box_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id TEXT NOT NULL,  -- References publication_issues.id (TEXT type)
  text_box_module_id UUID NOT NULL REFERENCES text_box_modules(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,  -- Set when newsletter is sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(issue_id, text_box_module_id)
);

-- Indexes for issue_text_box_modules
CREATE INDEX IF NOT EXISTS idx_issue_text_box_modules_issue ON issue_text_box_modules(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_text_box_modules_module ON issue_text_box_modules(text_box_module_id);

-- ============================================
-- Table: issue_text_box_blocks
-- Per-issue generated/override content for blocks
-- ============================================
CREATE TABLE IF NOT EXISTS issue_text_box_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id TEXT NOT NULL,  -- References publication_issues.id (TEXT type)
  text_box_block_id UUID NOT NULL REFERENCES text_box_blocks(id) ON DELETE CASCADE,

  -- Generated content (for AI blocks)
  generated_content TEXT,  -- AI-generated text content
  generated_image_url TEXT,  -- AI-generated image URL

  -- Manual override content (user can override AI content)
  override_content TEXT,
  override_image_url TEXT,

  -- Status tracking
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed', 'manual')),
  generation_error TEXT,
  generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(issue_id, text_box_block_id)
);

-- Indexes for issue_text_box_blocks
CREATE INDEX IF NOT EXISTS idx_issue_text_box_blocks_issue ON issue_text_box_blocks(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_text_box_blocks_block ON issue_text_box_blocks(text_box_block_id);
CREATE INDEX IF NOT EXISTS idx_issue_text_box_blocks_status ON issue_text_box_blocks(generation_status);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_text_box_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS text_box_modules_updated_at ON text_box_modules;
CREATE TRIGGER text_box_modules_updated_at
  BEFORE UPDATE ON text_box_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_text_box_updated_at();

DROP TRIGGER IF EXISTS text_box_blocks_updated_at ON text_box_blocks;
CREATE TRIGGER text_box_blocks_updated_at
  BEFORE UPDATE ON text_box_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_text_box_updated_at();

DROP TRIGGER IF EXISTS issue_text_box_modules_updated_at ON issue_text_box_modules;
CREATE TRIGGER issue_text_box_modules_updated_at
  BEFORE UPDATE ON issue_text_box_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_text_box_updated_at();

DROP TRIGGER IF EXISTS issue_text_box_blocks_updated_at ON issue_text_box_blocks;
CREATE TRIGGER issue_text_box_blocks_updated_at
  BEFORE UPDATE ON issue_text_box_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_text_box_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE text_box_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_box_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_text_box_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_text_box_blocks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API routes using supabaseAdmin)
CREATE POLICY "Service role has full access to text_box_modules"
  ON text_box_modules FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to text_box_blocks"
  ON text_box_blocks FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to issue_text_box_modules"
  ON issue_text_box_modules FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to issue_text_box_blocks"
  ON issue_text_box_blocks FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE text_box_modules IS 'Configurable text box sections for newsletters (Welcome, Latest in AI, etc.)';
COMMENT ON TABLE text_box_blocks IS 'Individual blocks within text box modules (static text, AI prompt, image)';
COMMENT ON TABLE issue_text_box_modules IS 'Per-issue tracking of text box module selections';
COMMENT ON TABLE issue_text_box_blocks IS 'Per-issue generated/override content for text box blocks';

COMMENT ON COLUMN text_box_modules.show_name IS 'Whether to display the module name as a section header in the newsletter';
COMMENT ON COLUMN text_box_blocks.block_type IS 'Type of block: static_text (Quill HTML), ai_prompt (AI-generated), image (static or AI)';
COMMENT ON COLUMN text_box_blocks.text_size IS 'Font size for static text: small (14px), medium (16px), large (20px semibold)';
COMMENT ON COLUMN text_box_blocks.generation_timing IS 'When to generate AI content: before_articles (basic metadata) or after_articles (full context)';
COMMENT ON COLUMN issue_text_box_blocks.generation_status IS 'Status: pending, generating, completed, failed, or manual (user override)';
