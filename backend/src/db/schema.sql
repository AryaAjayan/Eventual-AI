-- Identity Graph
CREATE TABLE IF NOT EXISTS identities (
  canonical_user_id TEXT PRIMARY KEY,
  primary_email TEXT
);

CREATE TABLE IF NOT EXISTS identity_aliases (
  alias_type TEXT NOT NULL,
  alias_value TEXT NOT NULL,
  canonical_user_id TEXT REFERENCES identities(canonical_user_id),
  PRIMARY KEY (alias_type, alias_value)
);

-- Append-only log table
CREATE TABLE IF NOT EXISTS canonical_event_log (
  sequence_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedup_key TEXT NOT NULL,
  action TEXT NOT NULL,
  delta TEXT NOT NULL, -- Stored as JSON string in SQLite
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by dedup_key
CREATE INDEX IF NOT EXISTS idx_event_log_dedup_key ON canonical_event_log(dedup_key);

-- The materialized state table
CREATE TABLE IF NOT EXISTS canonical_events_current (
  dedup_key TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  model TEXT,
  event_timestamp DATETIME NOT NULL,
  ingested_at DATETIME NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  requests INTEGER,
  cost_amount REAL,
  cost_currency TEXT DEFAULT 'USD',
  cost_status TEXT DEFAULT 'pending',
  source_user_id TEXT,
  source_email TEXT,
  source_device_id TEXT,
  canonical_user_id TEXT,
  raw_extra TEXT -- Stored as JSON string
);

-- Quarantine for drifted/invalid payloads
CREATE TABLE IF NOT EXISTS quarantined_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor TEXT,
  payload TEXT, -- JSON
  error_reason TEXT,
  quarantined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending'
);

-- Trigger function to fold the append-only log into the materialized state
CREATE TRIGGER IF NOT EXISTS trigger_fold_event_log_ingest
AFTER INSERT ON canonical_event_log
WHEN NEW.action = 'INGEST'
BEGIN
  INSERT INTO canonical_events_current (
    dedup_key, schema_version, vendor, product, model, 
    event_timestamp, ingested_at, input_tokens, output_tokens, 
    total_tokens, requests, cost_amount, cost_currency, cost_status, 
    source_user_id, source_email, source_device_id, canonical_user_id, raw_extra
  ) VALUES (
    NEW.dedup_key,
    json_extract(NEW.delta, '$.schema_version'),
    json_extract(NEW.delta, '$.vendor'),
    json_extract(NEW.delta, '$.product'),
    json_extract(NEW.delta, '$.model'),
    json_extract(NEW.delta, '$.event_timestamp'),
    json_extract(NEW.delta, '$.ingested_at'),
    json_extract(NEW.delta, '$.input_tokens'),
    json_extract(NEW.delta, '$.output_tokens'),
    json_extract(NEW.delta, '$.total_tokens'),
    json_extract(NEW.delta, '$.requests'),
    json_extract(NEW.delta, '$.cost_amount'),
    COALESCE(json_extract(NEW.delta, '$.cost_currency'), 'USD'),
    COALESCE(json_extract(NEW.delta, '$.cost_status'), 'pending'),
    json_extract(NEW.delta, '$.source_user_id'),
    json_extract(NEW.delta, '$.source_email'),
    json_extract(NEW.delta, '$.source_device_id'),
    json_extract(NEW.delta, '$.canonical_user_id'),
    json_extract(NEW.delta, '$.raw_extra')
  )
  ON CONFLICT(dedup_key) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS trigger_fold_event_log_update_cost
AFTER INSERT ON canonical_event_log
WHEN NEW.action = 'UPDATE_COST'
BEGIN
  UPDATE canonical_events_current
  SET 
    cost_amount = json_extract(NEW.delta, '$.cost_amount'),
    cost_currency = COALESCE(json_extract(NEW.delta, '$.cost_currency'), cost_currency),
    cost_status = COALESCE(json_extract(NEW.delta, '$.cost_status'), 'resolved')
  WHERE dedup_key = NEW.dedup_key;
END;

CREATE TRIGGER IF NOT EXISTS trigger_fold_event_log_resolve_identity
AFTER INSERT ON canonical_event_log
WHEN NEW.action = 'RESOLVE_IDENTITY'
BEGIN
  UPDATE canonical_events_current
  SET canonical_user_id = json_extract(NEW.delta, '$.canonical_user_id')
  WHERE dedup_key = NEW.dedup_key;
END;
