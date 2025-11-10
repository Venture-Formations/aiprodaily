-- Create contact_submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  newsletter_id TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  CONSTRAINT fk_newsletter
    FOREIGN KEY (newsletter_id)
    REFERENCES newsletters(slug)
    ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_newsletter_id
ON contact_submissions(newsletter_id);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
ON contact_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
ON contact_submissions(status);

-- Add comment
COMMENT ON TABLE contact_submissions IS 'Stores contact form submissions from the public website';
