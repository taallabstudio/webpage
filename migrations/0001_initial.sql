CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  message TEXT DEFAULT '',
  total_size INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','deleted'))
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  download_token TEXT NOT NULL UNIQUE,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','deleted')),
  FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transfers_expires ON transfers(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_files_transfer ON files(transfer_id);
CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_files_token ON files(download_token);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
