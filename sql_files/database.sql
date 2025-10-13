-- St. Cloud Scoop Newsletter Database Schema
-- Based on PRD specifications

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables

-- Newsletter campaigns table
CREATE TABLE newsletter_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'sent', 'failed')),
    subject_line TEXT,
    review_sent_at TIMESTAMPTZ,
    final_sent_at TIMESTAMPTZ,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSS feeds configuration
CREATE TABLE rss_feeds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    last_processed TIMESTAMPTZ,
    processing_errors INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw RSS posts
CREATE TABLE rss_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    external_id TEXT, -- unique ID from RSS feed
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    author VARCHAR(255),
    publication_date TIMESTAMPTZ,
    source_url TEXT,
    image_url TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feed_id, external_id)
);

-- AI ratings for posts
CREATE TABLE post_ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
    interest_level INTEGER CHECK (interest_level >= 1 AND interest_level <= 10),
    local_relevance INTEGER CHECK (local_relevance >= 1 AND local_relevance <= 10),
    community_impact INTEGER CHECK (community_impact >= 1 AND community_impact <= 10),
    total_score INTEGER GENERATED ALWAYS AS (interest_level + local_relevance + community_impact) STORED,
    ai_reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated newsletter articles
CREATE TABLE articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    content TEXT NOT NULL,
    rank INTEGER, -- order in newsletter
    is_active BOOLEAN DEFAULT true, -- included in final newsletter
    fact_check_score INTEGER,
    fact_check_details TEXT,
    word_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual articles (bypassing RSS)
CREATE TABLE manual_articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    source_url TEXT,
    rank INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User management (extends Supabase auth)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role VARCHAR(20) DEFAULT 'reviewer' CHECK (role IN ('admin', 'reviewer')),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System logs and monitoring
CREATE TABLE system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level VARCHAR(10) CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    source VARCHAR(50), -- rss_processor, ai_evaluator, email_sender, etc.
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Duplicate detection tracking
CREATE TABLE duplicate_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    primary_post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
    topic_signature TEXT, -- AI-generated topic identifier
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE duplicate_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    post_id UUID REFERENCES rss_posts(id) ON DELETE CASCADE,
    similarity_score DECIMAL(3,2), -- 0.00 to 1.00
    UNIQUE(group_id, post_id)
);

-- Analytics and performance tracking
CREATE TABLE email_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    mailerlite_campaign_id TEXT,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    open_rate DECIMAL(5,4),
    click_rate DECIMAL(5,4),
    bounce_rate DECIMAL(5,4),
    unsubscribe_rate DECIMAL(5,4),
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content performance tracking
CREATE TABLE article_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    click_count INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,4),
    feedback_positive INTEGER DEFAULT 0,
    feedback_negative INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity logs
CREATE TABLE user_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- article_toggled, manual_article_added, etc.
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration settings
CREATE TABLE app_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_newsletter_campaigns_date ON newsletter_campaigns(date);
CREATE INDEX idx_newsletter_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX idx_rss_posts_campaign_id ON rss_posts(campaign_id);
CREATE INDEX idx_rss_posts_feed_id ON rss_posts(feed_id);
CREATE INDEX idx_rss_posts_publication_date ON rss_posts(publication_date);
CREATE INDEX idx_post_ratings_post_id ON post_ratings(post_id);
CREATE INDEX idx_post_ratings_total_score ON post_ratings(total_score);
CREATE INDEX idx_articles_campaign_id ON articles(campaign_id);
CREATE INDEX idx_articles_is_active ON articles(is_active);
CREATE INDEX idx_articles_rank ON articles(rank);
CREATE INDEX idx_manual_articles_campaign_id ON manual_articles(campaign_id);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_campaign_id ON user_activities(campaign_id);
CREATE INDEX idx_user_activities_timestamp ON user_activities(timestamp);

-- Row Level Security (RLS) Policies
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read/write
CREATE POLICY "Authenticated users can access newsletter_campaigns" ON newsletter_campaigns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access rss_feeds" ON rss_feeds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access rss_posts" ON rss_posts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access post_ratings" ON post_ratings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access articles" ON articles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access manual_articles" ON manual_articles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access users" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access system_logs" ON system_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access duplicate_groups" ON duplicate_groups FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access duplicate_posts" ON duplicate_posts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access email_metrics" ON email_metrics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access article_performance" ON article_performance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access user_activities" ON user_activities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can access app_settings" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- Insert default RSS feed
INSERT INTO rss_feeds (url, name, active) VALUES
('https://rss.app/feeds/_flJgCqGgmZncd9Sk.xml', 'St. Cloud Local News', true);

-- Insert default app settings
INSERT INTO app_settings (key, value, description) VALUES
('ai_quality_threshold', '20', 'Minimum fact-check score for articles (out of 30)'),
('daily_processing_time', '20:30:00-06', 'Time to process RSS feeds (CT)'),
('review_deadline', '04:00:00-06', 'Deadline for review team changes (CT)'),
('max_articles_per_newsletter', '8', 'Maximum articles in newsletter'),
('min_articles_per_newsletter', '3', 'Minimum articles for sending newsletter'),
('backup_article_count', '3', 'Number of backup articles to prepare');

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_newsletter_campaigns_updated_at BEFORE UPDATE ON newsletter_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manual_articles_updated_at BEFORE UPDATE ON manual_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create new campaign for a given date
CREATE OR REPLACE FUNCTION create_campaign_for_date(campaign_date DATE)
RETURNS UUID AS $$
DECLARE
    new_campaign_id UUID;
BEGIN
    INSERT INTO newsletter_campaigns (date, status)
    VALUES (campaign_date, 'draft')
    RETURNING id INTO new_campaign_id;

    -- Log the campaign creation
    INSERT INTO system_logs (level, message, context, source)
    VALUES ('info', 'New campaign created',
            json_build_object('campaign_id', new_campaign_id, 'date', campaign_date),
            'campaign_manager');

    RETURN new_campaign_id;
END;
$$ LANGUAGE plpgsql;