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
  user_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT,
  coupon_code TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status, created_at);

CREATE TABLE IF NOT EXISTS store_customer_profiles (
  user_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  pincode TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  updated_at INTEGER NOT NULL
);
