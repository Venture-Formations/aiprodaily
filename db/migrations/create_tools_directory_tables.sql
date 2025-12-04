-- ============================================
-- AI Tools Directory Schema
-- Migration: create_tools_directory_tables
-- Date: 2025-12-02
-- ============================================

-- Directory Categories Table
CREATE TABLE IF NOT EXISTS directory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES publications(id),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(publication_id, slug)
);

-- Tools Directory Table (main tools/apps listing)
CREATE TABLE IF NOT EXISTS tools_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES publications(id),

    -- Core tool info
    tool_name TEXT NOT NULL,
    tagline TEXT,
    description TEXT NOT NULL,
    website_url TEXT NOT NULL,

    -- Images
    logo_url TEXT,
    screenshot_url TEXT,
    tool_image_url TEXT,

    -- Submission info
    clerk_user_id TEXT,
    submitter_email TEXT,
    submitter_name TEXT,
    submitter_image_url TEXT,

    -- Status and moderation
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,

    -- Sponsorship/Payment
    is_sponsored BOOLEAN DEFAULT false,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'yearly')),
    stripe_payment_id TEXT,
    sponsor_start_date TIMESTAMPTZ,
    sponsor_end_date TIMESTAMPTZ,

    -- Display settings
    is_featured BOOLEAN DEFAULT false,
    display_order INT,

    -- Analytics
    view_count INT DEFAULT 0,
    click_count INT DEFAULT 0,

    -- Legacy link to ai_applications (if seeded)
    legacy_ai_app_id UUID,
    is_affiliate BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS directory_categories_tools (
    category_id UUID REFERENCES directory_categories(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools_directory(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (category_id, tool_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tools_directory_publication ON tools_directory(publication_id);
CREATE INDEX IF NOT EXISTS idx_tools_directory_status ON tools_directory(status);
CREATE INDEX IF NOT EXISTS idx_tools_directory_clerk_user ON tools_directory(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_tools_directory_sponsored ON tools_directory(is_sponsored) WHERE is_sponsored = true;
CREATE INDEX IF NOT EXISTS idx_directory_categories_publication ON directory_categories(publication_id);
CREATE INDEX IF NOT EXISTS idx_directory_categories_slug ON directory_categories(slug);

-- Enable RLS
ALTER TABLE directory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_categories_tools ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access
CREATE POLICY "Allow public read on directory_categories"
    ON directory_categories FOR SELECT USING (true);

CREATE POLICY "Allow public read on tools_directory"
    ON tools_directory FOR SELECT USING (true);

CREATE POLICY "Allow public read on directory_categories_tools"
    ON directory_categories_tools FOR SELECT USING (true);

-- RLS Policies: Authenticated insert (for submissions)
CREATE POLICY "Allow authenticated insert on tools_directory"
    ON tools_directory FOR INSERT WITH CHECK (true);

-- RLS Policies: Service role full access (for admin operations)
CREATE POLICY "Allow service role all on directory_categories"
    ON directory_categories FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role all on tools_directory"
    ON tools_directory FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role all on directory_categories_tools"
    ON directory_categories_tools FOR ALL USING (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_directory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tools_directory_updated_at
    BEFORE UPDATE ON tools_directory
    FOR EACH ROW EXECUTE FUNCTION update_directory_updated_at();

CREATE TRIGGER directory_categories_updated_at
    BEFORE UPDATE ON directory_categories
    FOR EACH ROW EXECUTE FUNCTION update_directory_updated_at();

-- ============================================
-- Seed Categories (run after table creation)
-- ============================================
-- INSERT INTO directory_categories (publication_id, name, slug, description, display_order, status)
-- VALUES
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Accounting System', 'accounting-system', 'AI-powered accounting software', 1, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Banking', 'banking', 'AI tools for banking integrations', 2, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Client Management', 'client-management', 'AI solutions for client relationships', 3, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Finance', 'finance', 'AI tools for financial analysis', 4, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'HR', 'hr', 'AI-powered HR tools', 5, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Payroll', 'payroll', 'AI solutions for payroll processing', 6, 'approved'),
--     ('eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf', 'Productivity', 'productivity', 'AI tools for workflow automation', 7, 'approved');
