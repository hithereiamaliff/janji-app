import { MAX_GUESTS_PER_REQUEST } from "./booking-actions";
import type { BookingPerson } from "./booking-detail";

// Loose on purpose: Cal.diy validates the address itself, and this only catches obvious typos.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type GuestEmailsCheck =
  | { ok: true; emails: string[] }
  | { ok: false; problem: "missing" | "too_many" }
  | { ok: false; problem: "invalid" | "already_attending"; emails: string[] };

/**
 * Reads the addresses typed into the add-guests form (one per line, or separated by commas, semicolons or
 * spaces) and checks them before anything is sent.
 */
export function checkGuestEmails(text: string, attendees: readonly BookingPerson[]): GuestEmailsCheck {
  // Addresses aren't case-sensitive in practice, so a repeat in other letter case is dropped, keeping the
  // first spelling.
  const unique = new Map<string, string>();
  for (const email of text.split(/[\s,;]+/)) {
    if (email && !unique.has(email.toLowerCase())) unique.set(email.toLowerCase(), email);
  }
  const emails = [...unique.values()];
  if (emails.length === 0) return { ok: false, problem: "missing" };

  const invalid = emails.filter((email) => !EMAIL.test(email));
  if (invalid.length > 0) return { ok: false, problem: "invalid", emails: invalid };
  if (emails.length > MAX_GUESTS_PER_REQUEST) return { ok: false, problem: "too_many" };

  const attending = new Set(
    attendees.flatMap((person) => [person.email.toLowerCase(), person.displayEmail.toLowerCase()])
  );
  const already = emails.filter((email) => attending.has(email.toLowerCase()));
  if (already.length > 0) return { ok: false, problem: "already_attending", emails: already };

  return { ok: true, emails };
}
