-- Store-only schema. Run this against the taallab-store D1 database, never taallab-transfers.
CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  customer_email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status, created_at);