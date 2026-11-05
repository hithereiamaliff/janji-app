import type { BookingWebhook } from "./webhook";

export type Alert = {
  title: string;
  body: string;
  /** Opens the booking when the notification is tapped. */
  data: { bookingUid: string };
};

// Only English so far; the app's other languages will bring theirs.
const TITLES = {
  created: "New booking",
  createdRecurring: "New recurring booking",
  confirmed: "Booking confirmed",
  requested: "Needs your confirmation",
  requestedRecurring: "Recurring booking needs your confirmation",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

function titleFor({ trigger, requiresConfirmation, recurring }: BookingWebhook): string {
  switch (trigger) {
    case "BOOKING_CREATED":
      // Confirming a booking that needed it fires BOOKING_CREATED as well, after BOOKING_REQUESTED.
      if (requiresConfirmation) return TITLES.confirmed;
      return recurring ? TITLES.createdRecurring : TITLES.created;
    case "BOOKING_REQUESTED":
      return recurring ? TITLES.requestedRecurring : TITLES.requested;
    case "BOOKING_RESCHEDULED":
      return TITLES.rescheduled;
    case "BOOKING_CANCELLED":
      return TITLES.cancelled;
  }
}

function startText(start: string, timeZone: string, locale: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  };
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(start));
  } catch {
    // A locale or time zone this runtime doesn't know shouldn't cost the person the notification.
    return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(start));
  }
}

/** "Consultation · Thu, 12 Nov, 3:00 pm · Jane", with the time on the organizer's clock. */
export function alertFor(webhook: BookingWebhook, locale: string): Alert {
  return {
    title: titleFor(webhook),
    body: [webhook.eventTitle, startText(webhook.start, webhook.timeZone, locale), webhook.attendeeName]
      .filter(Boolean)
      .join(" · "),
    data: { bookingUid: webhook.uid },
  };
}

/**
 * Identifies an alert, so a webhook that comes twice sends one. Each booking in a recurring series fires its
 * own webhook with its own uid, and nothing ties them together, so a series is told apart by its event and
 * attendee instead: one alert for the series.
 */
export function dedupeKey(deviceId: string, webhook: BookingWebhook): string {
  const booking = webhook.recurring
    ? `series:${webhook.eventTitle}:${webhook.attendeeName ?? ""}`
    : webhook.uid;
  return `${deviceId}:${webhook.trigger}:${booking}`;
}
