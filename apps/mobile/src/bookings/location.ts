/** Where a booking happens, read from API v2's `location`. */
export type BookingPlace =
  /** A meeting link, such as Google Meet, Zoom or Cal Video. */
  | { kind: "link"; url: string; host: string }
  | { kind: "phone"; number: string }
  /** A conferencing app API v2 sends no link for, such as `integrations:daily` before the room exists. */
  | { kind: "app" }
  /** An address, or whatever else the organizer wrote. */
  | { kind: "text"; text: string };

// Only http(s) locations become links, so a location can't make the app open some other app's URL scheme.
// A regex reads the host because React Native's URL class doesn't validate what it's given.
const LINK = /^https?:\/\/(?:[^/?#@\s]*@)?([^/?#:\s]+)/i;
const PHONE = /^\+?[\d\s().-]{6,}$/;

export function describeLocation(location: string): BookingPlace {
  const text = location.trim();
  const host = LINK.exec(text)?.[1];
  if (host) return { kind: "link", url: text, host: host.toLowerCase() };
  if (text.startsWith("integrations:")) return { kind: "app" };
  if (PHONE.test(text)) return { kind: "phone", number: text };
  return { kind: "text", text };
}

/** A tel: URL without the spaces, dashes and brackets people write phone numbers with. */
export function phoneUrl(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}
