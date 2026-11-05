/** Where a booking happens, read from API v2's `location`. */
export type BookingPlace =
  /** A meeting link, such as Google Meet, Zoom or Cal Video. */
  | { kind: "link"; url: string; host: string }
  | { kind: "phone"; number: string }
  /** A conferencing app API v2 sends no link for, such as `integrations:daily` before the room exists. */
  | { kind: "app" }
  /** An address, or whatever else the organizer wrote. */
  | { kind: "text"; text: string };

const PHONE = /^\+?[\d\s().-]{6,}$/;

// Only web links open, so a location can't make the app open another app's URL scheme.
function webLink(text: string): URL | null {
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function describeLocation(location: string): BookingPlace {
  const text = location.trim();
  const link = webLink(text);
  if (link) return { kind: "link", url: link.href, host: link.hostname };
  if (text.startsWith("integrations:")) return { kind: "app" };
  if (PHONE.test(text)) return { kind: "phone", number: text };
  return { kind: "text", text };
}

/** A tel: URL without the spaces, dashes and brackets people write phone numbers with. */
export function phoneUrl(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}
