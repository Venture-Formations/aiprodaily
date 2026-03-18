-- Migration: congress_feed_articles and congress_approved_sources
-- Date: 2026-03-17
-- Description:
--   1. Creates congress_feed_articles table for storing news articles related to congressional trades
--   2. Creates congress_approved_sources table for whitelisting high-quality financial news domains
--   3. Adds last_ingestion_at column to combined_feed_settings
--   4. Seeds approved sources with top financial news domains

-- 1. Congress feed articles table
CREATE TABLE IF NOT EXISTS congress_feed_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  transaction_type TEXT,
  article_title TEXT NOT NULL,
  article_url TEXT NOT NULL UNIQUE,
  article_description TEXT,
  source_name TEXT,
  source_domain TEXT,
  published_at TIMESTAMPTZ,
  trade_meta JSONB,
  ingested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfa_published ON congress_feed_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfa_source_domain ON congress_feed_articles(source_domain);
CREATE INDEX IF NOT EXISTS idx_cfa_ticker ON congress_feed_articles(ticker);

-- 2. Approved sources table
CREATE TABLE IF NOT EXISTS congress_approved_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_domain TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add last_ingestion_at to combined_feed_settings
ALTER TABLE combined_feed_settings ADD COLUMN IF NOT EXISTS last_ingestion_at TIMESTAMPTZ;

-- 4. Seed approved sources
INSERT INTO congress_approved_sources (source_name, source_domain) VALUES
  ('Yahoo Finance', 'finance.yahoo.com'),
  ('Seeking Alpha', 'seekingalpha.com'),
  ('Business Wire', 'businesswire.com'),
  ('Investopedia', 'investopedia.com'),
  ('Reuters', 'reuters.com'),
  ('Stock Titan', 'stocktitan.net'),
  ('CNBC', 'cnbc.com'),
  ('Nasdaq', 'nasdaq.com'),
  ('MarketBeat', 'marketbeat.com'),
  ('PR Newswire', 'prnewswire.com'),
  ('Bloomberg.com', 'bloomberg.com'),
  ('The Business Journals', 'bizjournals.com'),
  ('The Motley Fool', 'fool.com'),
  ('Barron''s', 'barrons.com'),
  ('Fortune', 'fortune.com'),
  ('Investing.com', 'investing.com'),
  ('The New York Times', 'nytimes.com'),
  ('TradingView', 'tradingview.com'),
  ('GlobeNewswire', 'globenewswire.com'),
  ('Kiplinger', 'kiplinger.com'),
  ('simplywall.st', 'simplywall.st'),
  ('TechTarget', 'techtarget.com'),
  ('The Globe and Mail', 'theglobeandmail.com'),
  ('WSJ', 'wsj.com'),
  ('AP News', 'apnews.com'),
  ('Business Insider', 'businessinsider.com'),
  ('GuruFocus', 'gurufocus.com'),
  ('Investor''s Business Daily', 'investors.com'),
  ('MarketWatch', 'marketwatch.com'),
  ('Morningstar', 'morningstar.com'),
  ('Forbes', 'forbes.com'),
  ('The Guardian', 'theguardian.com'),
  ('USA Today', 'usatoday.com')
ON CONFLICT (source_domain) DO NOTHING;
