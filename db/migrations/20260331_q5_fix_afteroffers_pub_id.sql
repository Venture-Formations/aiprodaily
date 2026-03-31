-- Phase 3, Q5: Fix afteroffers_events.publication_id TEXT → UUID
-- 214 rows, all valid UUIDs. Simple direct ALTER.
-- Unique constraint (publication_id, click_id, event_type) survives the type change.

ALTER TABLE afteroffers_events
  ALTER COLUMN publication_id TYPE uuid USING publication_id::uuid;
