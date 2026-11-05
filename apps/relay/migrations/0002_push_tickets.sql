-- Expo's ticket for each push it accepted, kept until its receipt says whether the phone could be reached.
-- Expo clears receipts after a day, so a ticket never lives longer than that.
CREATE TABLE push_tickets (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX push_tickets_created_at ON push_tickets (created_at);
