-- Congressional Trading RSS System
-- Replaces manual RSS feed source management with trade-driven feed generation

-- 1. Congress trades table (stores uploaded XLSX rows)
CREATE TABLE IF NOT EXISTS congress_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  ticker_type TEXT,
  company TEXT,
  traded DATE NOT NULL,
  filed DATE,
  transaction TEXT,
  trade_size_usd TEXT,
  trade_size_parsed NUMERIC DEFAULT 0,
  name TEXT,
  party TEXT,
  district TEXT,
  chamber TEXT,
  state TEXT,
  capitol_trades_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_congress_trades_ticker ON congress_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_congress_trades_traded ON congress_trades(traded DESC);
CREATE INDEX IF NOT EXISTS idx_congress_trades_size ON congress_trades(trade_size_parsed DESC);

-- 2. Ticker-to-company name lookup
CREATE TABLE IF NOT EXISTS ticker_company_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Excluded keywords for article filtering
CREATE TABLE IF NOT EXISTS combined_feed_excluded_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Excluded companies/tickers (funds, ETFs, etc.)
CREATE TABLE IF NOT EXISTS combined_feed_excluded_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add new columns to combined_feed_settings
ALTER TABLE combined_feed_settings
  ADD COLUMN IF NOT EXISTS url_template TEXT DEFAULT 'https://news.google.com/rss/search?q={company_name}+stock&hl=en-US&gl=US&ceid=US:en',
  ADD COLUMN IF NOT EXISTS max_trades INTEGER DEFAULT 21;
