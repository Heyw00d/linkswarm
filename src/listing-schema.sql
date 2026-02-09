-- Listing Swarm Schema
-- Separate from Link Swarm (network) tables

-- Sites registered for Listing Swarm
CREATE TABLE IF NOT EXISTS listing_sites (
  site_id VARCHAR(32) PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  categories TEXT[] NOT NULL,
  email TEXT NOT NULL,
  
  -- IMAP credentials (encrypted in production)
  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  imap_user TEXT NOT NULL,
  imap_pass TEXT NOT NULL,
  
  -- Site info (optional - scraped if missing)
  name TEXT,
  tagline TEXT,
  description TEXT,
  logo TEXT,
  screenshots TEXT[],
  
  -- Status tracking
  matched_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, processing, complete
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual directory submissions
CREATE TABLE IF NOT EXISTS listing_submissions (
  id SERIAL PRIMARY KEY,
  site_id VARCHAR(32) REFERENCES listing_sites(site_id),
  directory_slug VARCHAR(64) NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, submitted, verified, live, failed
  error_message TEXT,
  
  -- Results
  listing_url TEXT,
  estimated_dr INTEGER,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(site_id, directory_slug)
);

-- Credentials for each directory account
CREATE TABLE IF NOT EXISTS listing_credentials (
  id SERIAL PRIMARY KEY,
  site_id VARCHAR(32) REFERENCES listing_sites(site_id),
  directory_slug VARCHAR(64) NOT NULL,
  
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- Client can change email pw to take control
  login_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(site_id, directory_slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listing_sites_status ON listing_sites(status);
CREATE INDEX IF NOT EXISTS idx_listing_submissions_site ON listing_submissions(site_id);
CREATE INDEX IF NOT EXISTS idx_listing_submissions_status ON listing_submissions(status);
CREATE INDEX IF NOT EXISTS idx_listing_credentials_site ON listing_credentials(site_id);
