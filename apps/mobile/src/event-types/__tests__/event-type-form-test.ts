import type { EventTypeSummary } from "@/event-types/event-type";
import {
  checkEventTypeForm,
  type EventTypeForm,
  formFor,
  noticeInUnits,
  slugify,
  slugToSave,
} from "@/event-types/event-type-form";

const consultation: EventTypeSummary = {
  id: 2,
  title: "Consultation",
  slug: "consultation",
  lengthInMinutes: 60,
  lengthOptions: [],
  description: "A first chat about your project.",
  minimumBookingNotice: 120,
  hidden: false,
};

const flexible: EventTypeSummary = {
  ...consultation,
  id: 3,
  title: "Flexible chat",
  slug: "chat",
  lengthInMinutes: 30,
  lengthOptions: [15, 30, 60],
};

function edited(eventType: EventTypeSummary, changes: Partial<EventTypeForm>): EventTypeForm {
  return { ...formFor(eventType), ...changes };
}

describe("noticeInUnits", () => {
  it.each([
    [0, { amount: 0, unit: "minutes" }],
    [45, { amount: 45, unit: "minutes" }],
    [90, { amount: 90, unit: "minutes" }],
    [120, { amount: 2, unit: "hours" }],
    [1500, { amount: 25, unit: "hours" }],
    [1440, { amount: 1, unit: "days" }],
    [4320, { amount: 3, unit: "days" }],
  ])("shows %i minutes in the largest unit it's a whole number of", (minutes, notice) => {
    expect(noticeInUnits(minutes)).toEqual(notice);
  });
});

describe("slugify", () => {
  it.each([
    ["Consultation", "consultation"],
    ["  30 Min Meeting  ", "30-min-meeting"],
    ["Hello, World!", "hello-world"],
    ["Über_Cool #1", "uber-cool-1"],
    ["Café crème", "cafe-creme"],
    ["预约 咨询", "预约-咨询"],
    ["v1..2", "v1.2"],
    ["-.Edges.-", "edges"],
    ["!!!", ""],
  ])("cleans %j up as Cal.diy's web form does", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe("slugToSave", () => {
  it("cleans up a slug that was edited", () => {
    expect(slugToSave(edited(consultation, { slug: "First Chat" }), consultation)).toBe("first-chat");
  });

  it("keeps a slug that wasn't touched exactly as it is, even one the web form would tidy", () => {
    const madeThroughTheApi = { ...consultation, slug: "Consultation_2026" };

    expect(slugToSave(formFor(madeThroughTheApi), madeThroughTheApi)).toBe("Consultation_2026");
  });
});

describe("checkEventTypeForm", () => {
  it("sends nothing when nothing changed", () => {
    expect(checkEventTypeForm(formFor(consultation), consultation, ["chat"])).toEqual({
      ok: true,
      changes: {},
    });
  });

  it("sends only the settings that changed, tidied up", () => {
    const form = edited(consultation, {
      title: "  Discovery call ",
      slug: "Discovery Call",
      length: "45",
      description: "  What we'll cover.\n",
      noticeAmount: "1",
      noticeUnit: "days",
    });

    expect(checkEventTypeForm(form, consultation, ["chat"])).toEqual({
      ok: true,
      changes: {
        title: "Discovery call",
        slug: "discovery-call",
        lengthInMinutes: 45,
        description: "What we'll cover.",
        minimumBookingNotice: 1440,
      },
    });
  });

  it("leaves settings alone that weren't touched, even ones the web form would tidy", () => {
    const madeThroughTheApi = { ...consultation, title: "Consultation ", slug: "Consultation" };
    const form = edited(madeThroughTheApi, { description: "New description" });

    expect(checkEventTypeForm(form, madeThroughTheApi, [])).toEqual({
      ok: true,
      changes: { description: "New description" },
    });
  });

  it("doesn't count edits that come out the same as a change", () => {
    const form = edited(consultation, {
      title: "Consultation ",
      slug: "CONSULTATION ",
      length: " 60",
      noticeAmount: "120",
      noticeUnit: "minutes",
    });

    expect(checkEventTypeForm(form, consultation, [])).toEqual({ ok: true, changes: {} });
  });

  it("clears the description when it's emptied", () => {
    expect(checkEventTypeForm(edited(consultation, { description: "  " }), consultation, [])).toEqual({
      ok: true,
      changes: { description: "" },
    });
  });

  it("sends a notice of 0 to drop the minimum", () => {
    expect(checkEventTypeForm(edited(consultation, { noticeAmount: "0" }), consultation, [])).toEqual({
      ok: true,
      changes: { minimumBookingNotice: 0 },
    });
  });

  it("explains everything that needs fixing at once", () => {
    const form = edited(consultation, { title: " ", slug: "!!!", length: "0", noticeAmount: "soon" });

    expect(checkEventTypeForm(form, consultation, [])).toEqual({
      ok: false,
      errors: { title: "missing", slug: "missing", length: "invalid", notice: "invalid" },
    });
  });

  it.each(["", "1.5", "-30", "thirty"])("refuses %j as a length", (length) => {
    expect(checkEventTypeForm(edited(consultation, { length }), consultation, [])).toEqual({
      ok: false,
      errors: { length: "invalid" },
    });
  });

  it.each(["", "2.5", "-1"])("refuses %j as a notice", (noticeAmount) => {
    expect(checkEventTypeForm(edited(consultation, { noticeAmount }), consultation, [])).toEqual({
      ok: false,
      errors: { notice: "invalid" },
    });
  });

  it("refuses a slug another event type already has", () => {
    expect(checkEventTypeForm(edited(consultation, { slug: "Chat" }), consultation, ["chat"])).toEqual({
      ok: false,
      errors: { slug: "taken" },
    });
  });

  it("changes the default among the lengths on offer, whatever the length field holds", () => {
    const form = edited(flexible, { lengthChoice: 60, length: "not used" });

    expect(checkEventTypeForm(form, flexible, [])).toEqual({ ok: true, changes: { lengthInMinutes: 60 } });
  });
});
