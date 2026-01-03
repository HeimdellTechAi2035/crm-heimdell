-- Heimdell CRM Database Schema for Neon Postgres
-- Run this against your Neon database to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercase, trimmed for duplicate detection
  website TEXT,
  phone TEXT,
  address TEXT,
  ranking TEXT,
  market TEXT,
  review_count INTEGER,
  review_rating NUMERIC(3,2),
  main_category TEXT,
  meta JSONB DEFAULT '{}', -- store any extra CSV columns here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one company per normalized name per user
  CONSTRAINT unique_company_per_user UNIQUE(user_id, normalized_name)
);

-- Indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_normalized_name ON companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_companies_main_category ON companies(main_category);

-- ============================================================================
-- LEADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  source TEXT DEFAULT 'csv_import',
  meta JSONB DEFAULT '{}', -- store any extra data here
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============================================================================
-- DEALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title TEXT,
  stage TEXT DEFAULT 'lead', -- lead, qualified, proposal, negotiation, won, lost
  value NUMERIC(15,2),
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  meta JSONB DEFAULT '{}', -- store any extra data here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for deals
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);

-- ============================================================================
-- IMPORT_JOBS TABLE (track import history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT,
  total_rows INTEGER DEFAULT 0,
  companies_created INTEGER DEFAULT 0,
  companies_updated INTEGER DEFAULT 0,
  leads_created INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for import jobs
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);

-- ============================================================================
-- UPDATE TRIGGER for updated_at columns
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPFUL VIEWS
-- ============================================================================

-- Companies with counts
CREATE OR REPLACE VIEW companies_with_counts AS
SELECT 
  c.*,
  COUNT(DISTINCT l.id) AS lead_count,
  COUNT(DISTINCT d.id) AS deal_count,
  COALESCE(SUM(d.value), 0) AS total_deal_value
FROM companies c
LEFT JOIN leads l ON l.company_id = c.id
LEFT JOIN deals d ON d.company_id = c.id
GROUP BY c.id;

-- ============================================================================
-- SAMPLE DATA (optional - uncomment to insert test user)
-- ============================================================================
-- INSERT INTO users (email) VALUES ('test@example.com') ON CONFLICT (email) DO NOTHING;
