-- Images Database Schema Migration
-- This creates the complete images database structure as specified

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key TEXT NOT NULL,                              -- original/{uuid}.jpg
  cdn_url TEXT GENERATED ALWAYS AS (
    'https://ktmuicyailtbcpmworxf.supabase.co/storage/v1/object/public/images/' || object_key
  ) STORED,
  width INT,
  height INT,
  aspect_ratio FLOAT,
  orientation TEXT CHECK (orientation IN ('landscape','portrait','square')),
  source_url TEXT,
  license TEXT,
  credit TEXT,
  location TEXT,
  faces_count INT DEFAULT 0,
  has_text BOOL DEFAULT FALSE,
  dominant_colors TEXT[],
  safe_score FLOAT,
  ai_caption TEXT,
  ai_alt_text TEXT,
  ai_tags TEXT[],
  ai_tags_scored JSONB,
  emb_caption VECTOR(768),
  crop_ratio TEXT DEFAULT '16:9',
  crop_v_offset FLOAT DEFAULT 0.5,
  variant_16x9_key TEXT,
  variant_16x9_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS images_emb_ivf ON images USING ivfflat (emb_caption vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS images_created_idx ON images (created_at DESC);
CREATE INDEX IF NOT EXISTS images_orientation_idx ON images (orientation);
CREATE INDEX IF NOT EXISTS images_ai_tags_idx ON images USING GIN (ai_tags);
CREATE INDEX IF NOT EXISTS images_dominant_colors_idx ON images USING GIN (dominant_colors);

-- Optional: Create image_variants table for future use
CREATE TABLE IF NOT EXISTS image_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL, -- '16:9', '1:1', '4:3', etc.
  width INT NOT NULL,
  height INT NOT NULL,
  object_key TEXT NOT NULL,
  cdn_url TEXT GENERATED ALWAYS AS (
    'https://zvyzhmhsubazkvcsxbjs.supabase.co/storage/v1/object/public/' || object_key
  ) STORED,
  github_url TEXT,
  crop_v_offset FLOAT DEFAULT 0.5,
  crop_h_offset FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Create article_image_choices table for deterministic newsletter output
CREATE TABLE IF NOT EXISTS article_image_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  choice_reason TEXT, -- 'ai_matched', 'manual_selection', 'fallback'
  confidence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id)
);

-- Update trigger for images updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE images IS 'Core images library with AI analysis, embeddings, and variant tracking';
COMMENT ON COLUMN images.object_key IS 'Supabase storage path: images/original/{uuid}.jpg';
COMMENT ON COLUMN images.cdn_url IS 'Auto-generated Supabase CDN URL for direct access';
COMMENT ON COLUMN images.ai_tags_scored IS 'JSON array of {type, name, conf} tag objects from AI analysis';
COMMENT ON COLUMN images.emb_caption IS '768-dimensional vector embedding of AI caption for similarity search';
COMMENT ON COLUMN images.crop_v_offset IS 'Vertical crop offset: 0=top, 0.5=center, 1=bottom';
COMMENT ON COLUMN images.variant_16x9_key IS 'Storage key for 16:9 cropped variant';
COMMENT ON COLUMN images.variant_16x9_url IS 'GitHub CDN URL for 16:9 variant';