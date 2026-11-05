// What the app and the relay send each other. The relay checks everything it receives, since anyone can call it.

export type DevicePlatform = "ios" | "android";

/** POST /v1/devices: registers a phone, or registers it again with new credentials. */
export type RegisterDeviceRequest = {
  /** From expo-notifications, such as "ExponentPushToken[…]". */
  expoPushToken: string;
  platform: DevicePlatform;
  /** The phone's language, such as "en-MY", which notifications are written in. */
  locale: string;
};

export type RegisterDeviceResponse = {
  deviceId: string;
  /** Proves the app owns the device when it changes or removes it. Only the app keeps it. */
  deviceToken: string;
  /** Where Cal.diy sends this phone's webhooks. */
  hookUrl: string;
  /** The secret Cal.diy signs this phone's webhooks with. */
  webhookSecret: string;
};

/** The relay's answer to a request it couldn't carry out. */
export type RelayError = {
  error: "invalid_request" | "rate_limited" | "unauthorized" | "not_found" | "push_token_taken";
};
