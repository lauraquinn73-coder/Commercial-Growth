-- Initialise a FRESH, PRIVATE, EU-jurisdiction D1 database before enabling data capture.
-- Not an in-place migration for older, populated scanner_scans/growth_leads tables.
-- Never publish DB identifiers or issue read/write D1 access from browser JavaScript.
CREATE TABLE IF NOT EXISTS scanner_scans (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 hostname TEXT NOT NULL,
 themes_json TEXT NOT NULL,
 partial INTEGER NOT NULL DEFAULT 0,
 outcome TEXT NOT NULL CHECK(outcome IN ('completed')),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 privacy_version TEXT NOT NULL,
 consent_at INTEGER NOT NULL,
 consent_purpose TEXT NOT NULL CHECK(consent_purpose='optional_scanner_history'),
 receipt_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_scanner_expires ON scanner_scans(expires_at);
CREATE INDEX IF NOT EXISTS idx_scanner_created ON scanner_scans(created_at);
CREATE TABLE IF NOT EXISTS growth_leads (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 business TEXT NOT NULL,
 answers_json TEXT NOT NULL,
 priorities_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 privacy_version TEXT NOT NULL,
 consent_at INTEGER NOT NULL,
 consent_purpose TEXT NOT NULL CHECK(consent_purpose='voluntary_diagnostic_enquiry'),
 receipt_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_leads_expires ON growth_leads(expires_at);
CREATE INDEX IF NOT EXISTS idx_leads_created ON growth_leads(created_at);
