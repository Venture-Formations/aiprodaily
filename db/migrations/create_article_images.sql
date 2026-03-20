-- Article Images: stores member photos, transaction type icons, and custom images
-- for trade-based article modules (e.g., congress stock trade newsletters)

CREATE TABLE IF NOT EXISTS article_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES newsletters(id),
  category TEXT NOT NULL,          -- 'member', 'transaction', 'custom'
  lookup_key TEXT NOT NULL,        -- normalized: 'nancy-pelosi', 'purchase'
  display_name TEXT NOT NULL,      -- 'Nancy Pelosi', 'Purchase'
  image_url TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',     -- { party, state, chamber } for members
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, category, lookup_key)
);

CREATE INDEX idx_article_images_pub_cat ON article_images(publication_id, category);
