-- Add paid_placement column to dining_deals table
ALTER TABLE dining_deals ADD COLUMN IF NOT EXISTS paid_placement BOOLEAN DEFAULT FALSE;

-- Add paid_placement column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS paid_placement BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dining_deals_paid_placement ON dining_deals(paid_placement) WHERE paid_placement = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_paid_placement ON events(paid_placement) WHERE paid_placement = TRUE;

-- Success message
SELECT 'paid_placement columns added successfully to dining_deals and events tables!' as result;

-- Verify the changes
SELECT
    'dining_deals' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'dining_deals' AND column_name = 'paid_placement'
UNION ALL
SELECT
    'events' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'paid_placement';
