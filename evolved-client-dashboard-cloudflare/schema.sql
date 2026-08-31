CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  slug TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_requests (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL,
  request_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  product_asin TEXT,
  desired_date TEXT,
  requester_name TEXT,
  requester_email TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  clickup_task_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_requests_client_created
ON work_requests(client_slug, created_at);
