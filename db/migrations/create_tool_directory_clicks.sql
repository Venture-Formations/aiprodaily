-- Tool Directory Click Analytics Table
-- Tracks clicks on categories, tool views, and external link clicks in the AI Tools Directory
-- Created: 2025-02-03

-- Create the table
CREATE TABLE IF NOT EXISTS tool_directory_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publication_id UUID NOT NULL,

  -- Click type: category_click, tool_view, external_link
  click_type TEXT NOT NULL CHECK (click_type IN ('category_click', 'tool_view', 'external_link')),

  -- Tool identifiers (for tool_view and external_link)
  tool_id UUID REFERENCES ai_applications(id) ON DELETE SET NULL,
  tool_name TEXT,

  -- Category identifiers (for category_click, also populated for tool clicks)
  category_slug TEXT,
  category_name TEXT,

  -- Destination URL (for external_link clicks)
  destination_url TEXT,

  -- Source tracking
  referrer_page TEXT,      -- e.g., '/tools', '/tools/category/productivity'
  referrer_type TEXT,      -- e.g., 'directory_home', 'category_page', 'tool_detail'

  -- Request metadata
  user_agent TEXT,
  ip_address TEXT,

  -- Timestamp
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries

-- Multi-tenant filtering (primary filter for all queries)
CREATE INDEX idx_tdc_publication ON tool_directory_clicks(publication_id);

-- Click type filtering
CREATE INDEX idx_tdc_type ON tool_directory_clicks(click_type);

-- Tool analytics queries
CREATE INDEX idx_tdc_tool ON tool_directory_clicks(tool_id) WHERE tool_id IS NOT NULL;

-- Category analytics queries
CREATE INDEX idx_tdc_category ON tool_directory_clicks(category_slug) WHERE category_slug IS NOT NULL;

-- Time-based queries (daily aggregations, date range filtering)
CREATE INDEX idx_tdc_date ON tool_directory_clicks(clicked_at);

-- Combined index for common dashboard queries (publication + date range)
CREATE INDEX idx_tdc_pub_date ON tool_directory_clicks(publication_id, clicked_at);

-- Add comment for documentation
COMMENT ON TABLE tool_directory_clicks IS 'Tracks user interactions with the AI Tools Directory including category clicks, tool detail views, and external website clicks';
