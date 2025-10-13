-- Create Wordle table for daily Wordle word tracking
CREATE TABLE IF NOT EXISTS wordle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,  -- Stores the date in YYYY-MM-DD format
    word VARCHAR(50) NOT NULL,
    definition TEXT NOT NULL,
    interesting_fact TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date for fast lookups
CREATE INDEX IF NOT EXISTS idx_wordle_date ON wordle(date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wordle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wordle_updated_at ON wordle;
CREATE TRIGGER trigger_update_wordle_updated_at
    BEFORE UPDATE ON wordle
    FOR EACH ROW
    EXECUTE FUNCTION update_wordle_updated_at();