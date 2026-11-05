-- The phones that get Janji's notifications. The relay keeps nothing about bookings: each webhook is turned
-- into a push notification and dropped.
CREATE TABLE devices (
  -- Random, and part of the hook URL Cal.diy calls for this phone.
  id TEXT PRIMARY KEY,
  -- The Expo push token. Registering it again keeps the same device, so a reinstall keeps its webhook.
  push_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  locale TEXT NOT NULL,
  -- SHA-256 of the token the app proves it owns the device with; the token itself isn't kept.
  token_hash TEXT NOT NULL,
  -- Checks the signature on Cal.diy's webhooks, so it has to be kept, but only encrypted with the relay's key.
  webhook_secret TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
