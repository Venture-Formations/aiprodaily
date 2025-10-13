-- Check events for September 26th, 2025
-- Run this in Supabase SQL Editor to see what events exist

-- Direct query for events on September 26th
SELECT
    id,
    title,
    venue,
    start_date,
    end_date,
    active,
    created_at
FROM events
WHERE
    start_date >= '2025-09-26T00:00:00'
    AND start_date <= '2025-09-26T23:59:59'
    AND active = true
ORDER BY start_date;

-- Also check for events that span into September 26th
SELECT
    id,
    title,
    venue,
    start_date,
    end_date,
    active,
    'spans_into_26th' as note
FROM events
WHERE
    start_date <= '2025-09-26T00:00:00'
    AND end_date >= '2025-09-26T00:00:00'
    AND active = true
ORDER BY start_date;

-- Check all events around that date range
SELECT
    id,
    title,
    venue,
    DATE(start_date) as event_date,
    start_date,
    end_date,
    active
FROM events
WHERE
    start_date >= '2025-09-24T00:00:00'
    AND start_date <= '2025-09-27T23:59:59'
    AND active = true
ORDER BY start_date;