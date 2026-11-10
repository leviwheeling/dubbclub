CREATE TABLE IF NOT EXISTS products (
  slug text PRIMARY KEY, position int NOT NULL, name text NOT NULL, category text NOT NULL,
  color text NOT NULL, image text NOT NULL, description text NOT NULL, fit text NOT NULL,
  measurements text NOT NULL DEFAULT '', approved boolean NOT NULL DEFAULT false, release_at timestamptz
);
CREATE TABLE IF NOT EXISTS variants (
  id text PRIMARY KEY, product_slug text NOT NULL REFERENCES products(slug), position int NOT NULL,
  size text NOT NULL, price int CHECK (price BETWEEN 50 AND 1000000), stock int NOT NULL DEFAULT 0,
  reserved int NOT NULL DEFAULT 0, CHECK (reserved >= 0 AND stock >= reserved)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, checkout_key uuid NOT NULL UNIQUE, access_token text NOT NULL UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','expired','partially_refunded','refunded')),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz,
  stripe_session text UNIQUE, stripe_intent text UNIQUE, email text, destination jsonb,
  shipping_cents int NOT NULL, automatic_tax boolean NOT NULL DEFAULT false,
  total_cents int, refunded_cents int NOT NULL DEFAULT 0, payment_review text
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id uuid NOT NULL REFERENCES orders(id), variant_id text NOT NULL REFERENCES variants(id),
  quantity int NOT NULL CHECK(quantity BETWEEN 1 AND 20), price int NOT NULL,
  name text NOT NULL, size text NOT NULL, color text NOT NULL, image text NOT NULL,
  PRIMARY KEY (order_id,variant_id)
);
CREATE TABLE IF NOT EXISTS shipments (
  order_id uuid PRIMARY KEY REFERENCES orders(id), attempt_id uuid NOT NULL UNIQUE,
  purchase_state text NOT NULL CHECK (purchase_state IN ('pending','unknown','failed','purchased')),
  provider_id text UNIQUE, label_url text, carrier text, tracking text, tracking_url text,
  postage_cents int NOT NULL, tracking_state text, tracking_at timestamptz, exception text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shipment_tracking_unique ON shipments(carrier,tracking) WHERE tracking IS NOT NULL;
CREATE TABLE IF NOT EXISTS shipping_quotes (
  rate_id text PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), carrier text NOT NULL,
  service text NOT NULL, cents int NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_events (
  provider text NOT NULL, event_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider,event_id)
);
CREATE TABLE IF NOT EXISTS email_jobs (
  job_key text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  first_attempt timestamptz, sent_at timestamptz, failed_at timestamptz, provider_id text, last_error text
);
CREATE TABLE IF NOT EXISTS subscribers (
  email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS owner_login_links (
  token_hash text PRIMARY KEY, email text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_sessions (
  token_hash text PRIMARY KEY, email text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS request_limits (
  key text PRIMARY KEY, hits int NOT NULL, resets_at timestamptz NOT NULL
);
