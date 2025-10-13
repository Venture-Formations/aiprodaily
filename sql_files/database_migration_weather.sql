-- Weather System Database Migration
-- Execute this in Supabase SQL Editor

-- Create weather_forecasts table
CREATE TABLE IF NOT EXISTS weather_forecasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    forecast_date DATE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    weather_data JSONB NOT NULL,
    html_content TEXT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index to prevent duplicate forecasts for same date
CREATE UNIQUE INDEX IF NOT EXISTS weather_forecasts_forecast_date_idx ON weather_forecasts(forecast_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_weather_forecasts_updated_at BEFORE UPDATE
    ON weather_forecasts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add Local Weather section to newsletter_sections table (only if it doesn't exist)
INSERT INTO newsletter_sections (name, display_order, is_active)
SELECT 'Local Weather', 30, true
WHERE NOT EXISTS (
    SELECT 1 FROM newsletter_sections WHERE name = 'Local Weather'
);

-- Enable Row Level Security
ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your auth setup)
CREATE POLICY "Enable all operations for weather_forecasts" ON weather_forecasts
    FOR ALL USING (true);