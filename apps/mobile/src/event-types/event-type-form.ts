import type { EventTypeSummary } from "./event-type";
import type { EventTypeChanges } from "./event-types-api";

export const NOTICE_UNITS = ["minutes", "hours", "days"] as const;
export type NoticeUnit = (typeof NOTICE_UNITS)[number];

const MINUTES_IN: Record<NoticeUnit, number> = { minutes: 1, hours: 60, days: 24 * 60 };

/** The largest unit the notice is a whole number of, so 120 minutes reads as 2 hours. */
export function noticeInUnits(minutes: number): { amount: number; unit: NoticeUnit } {
  if (minutes > 0 && minutes % MINUTES_IN.days === 0)
    return { amount: minutes / MINUTES_IN.days, unit: "days" };
  if (minutes > 0 && minutes % MINUTES_IN.hours === 0)
    return { amount: minutes / MINUTES_IN.hours, unit: "hours" };
  return { amount: minutes, unit: "minutes" };
}

/**
 * Cleans a slug up the way Cal.diy's web form does: lower case, accents dropped, and anything other than
 * letters, digits and dots turned into single dashes. Its API only trims what it's sent, so without this a slug
 * typed as "My Event" would be saved, and linked to, just like that.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^.\p{L}\p{N}]+/gu, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
}

/** What the edit form holds while someone types: numbers stay text until they're checked. */
export type EventTypeForm = {
  title: string;
  slug: string;
  /** Minutes, for an event type with one length. */
  length: string;
  /** The default, for an event type that offers several lengths. */
  lengthChoice: number;
  description: string;
  noticeAmount: string;
  noticeUnit: NoticeUnit;
};

export function formFor(eventType: EventTypeSummary): EventTypeForm {
  const notice = noticeInUnits(eventType.minimumBookingNotice);
  return {
    title: eventType.title,
    slug: eventType.slug,
    length: String(eventType.lengthInMinutes),
    lengthChoice: eventType.lengthInMinutes,
    description: eventType.description ?? "",
    noticeAmount: String(notice.amount),
    noticeUnit: notice.unit,
  };
}

/**
 * The slug the booking link will have once the form is saved. A slug left as it was stays exactly as it is,
 * even one the web form would have cleaned up differently, so saving other changes never moves the link.
 */
export function slugToSave(form: EventTypeForm, original: EventTypeSummary): string {
  return form.slug === original.slug ? original.slug : slugify(form.slug);
}

export type FormErrors = {
  title?: "missing";
  slug?: "missing" | "taken";
  length?: "invalid";
  notice?: "invalid";
};

export type FormCheck = { ok: true; changes: EventTypeChanges } | { ok: false; errors: FormErrors };

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/**
 * Checks the form and works out what changed, so only those settings are sent. `original` is the event type as
 * it was when the form opened: a setting left alone here is never sent, so one changed meanwhile on the web
 * stays changed. `otherSlugs` are the person's other event types' slugs, since two can't share a link.
 */
export function checkEventTypeForm(
  form: EventTypeForm,
  original: EventTypeSummary,
  otherSlugs: readonly string[]
): FormCheck {
  const initial = formFor(original);
  const errors: FormErrors = {};
  const changes: EventTypeChanges = {};

  if (form.title !== initial.title) {
    const title = form.title.trim();
    if (!title) errors.title = "missing";
    else if (title !== original.title) changes.title = title;
  }

  const slug = slugToSave(form, original);
  if (!slug) errors.slug = "missing";
  else if (slug !== original.slug) {
    if (otherSlugs.includes(slug)) errors.slug = "taken";
    else changes.slug = slug;
  }

  if (original.lengthOptions.length > 0) {
    if (form.lengthChoice !== original.lengthInMinutes) changes.lengthInMinutes = form.lengthChoice;
  } else if (form.length !== initial.length) {
    const length = wholeNumber(form.length);
    if (length === null || length < 1) errors.length = "invalid";
    else if (length !== original.lengthInMinutes) changes.lengthInMinutes = length;
  }

  if (form.description !== initial.description) {
    const description = form.description.trim();
    if (description !== initial.description) changes.description = description;
  }

  if (form.noticeAmount !== initial.noticeAmount || form.noticeUnit !== initial.noticeUnit) {
    const amount = wholeNumber(form.noticeAmount);
    if (amount === null) errors.notice = "invalid";
    else {
      const notice = amount * MINUTES_IN[form.noticeUnit];
      if (notice !== original.minimumBookingNotice) changes.minimumBookingNotice = notice;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, changes };
}
