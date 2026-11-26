CREATE TABLE demo_slots (
  start_ms INTEGER PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE
);
