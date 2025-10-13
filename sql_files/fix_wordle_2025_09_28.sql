-- Update Wordle data for 2025-09-28 to have good content
UPDATE wordle
SET
    word = 'STORM',
    definition = 'A violent weather condition with strong winds and heavy rain',
    interesting_fact = 'The word storm comes from Old English meaning to rage or be in commotion',
    updated_at = NOW()
WHERE date = '2025-09-28';

-- Verify the update
SELECT * FROM wordle WHERE date IN ('2025-09-28', '2025-09-29') ORDER BY date;