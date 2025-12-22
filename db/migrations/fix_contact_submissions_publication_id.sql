-- Fix contact_submissions to use UUID publication_id instead of slug
-- This aligns it with other tables like publication_settings
--
-- Previously: publication_id was TEXT referencing publications.slug
-- After: publication_id is UUID referencing publications.id
--
-- Applied: 2025-12-22

-- Step 1: Drop the incorrect foreign key constraint
ALTER TABLE contact_submissions DROP CONSTRAINT IF EXISTS fk_newsletter;

-- Step 2: Update existing data from slug to UUID
UPDATE contact_submissions cs
SET publication_id = p.id::text
FROM publications p
WHERE cs.publication_id = p.slug;

-- Step 3: Change column type to UUID
ALTER TABLE contact_submissions
ALTER COLUMN publication_id TYPE uuid USING publication_id::uuid;

-- Step 4: Add correct foreign key constraint referencing publications.id
ALTER TABLE contact_submissions
ADD CONSTRAINT contact_submissions_publication_id_fkey
FOREIGN KEY (publication_id) REFERENCES publications(id);
