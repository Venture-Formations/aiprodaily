-- Migration: Scheduled Upload Processing + Trade Freshness Filter
-- Adds staging table for XLSX uploads, quiver_upload_time tracking, and scheduling settings

-- 1. Staging table (mirrors congress_trades schema)
CREATE TABLE IF NOT EXISTS congress_trades_staged (
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
  quiver_upload_time DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add quiver_upload_time to live trades table
ALTER TABLE congress_trades ADD COLUMN IF NOT EXISTS quiver_upload_time DATE;
CREATE INDEX IF NOT EXISTS idx_congress_trades_quiver_upload ON congress_trades(quiver_upload_time DESC);

-- 3. Add scheduling + freshness columns to settings
ALTER TABLE combined_feed_settings
  ADD COLUMN IF NOT EXISTS upload_schedule_day INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS upload_schedule_time TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS staged_upload_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trade_freshness_days INTEGER DEFAULT 7;
