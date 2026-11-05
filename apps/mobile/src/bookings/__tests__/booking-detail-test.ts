import type { ApiBooking } from "@/bookings/booking";
import { bookingAnswers, fieldNameLabel, pickBooking, toBookingDetail } from "@/bookings/booking-detail";

const booking = {
  id: 1,
  uid: "booking-1",
  title: "1-to-1 call with Alan",
  description: "  Planning the Penang leg  ",
  hosts: [
    {
      id: 7,
      name: "Alan",
      email: "alan@example.com",
      displayEmail: "alan@example.com",
      username: "alan",
      timeZone: "Asia/Kuala_Lumpur",
    },
  ],
  status: "accepted",
  start: "2026-11-06T08:00:00.000Z",
  end: "2026-11-06T09:00:00.000Z",
  duration: 60,
  eventTypeId: 3,
  eventType: { id: 3, slug: "call-with-alan" },
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  location: "https://meet.google.com/abc-defg-hij",
  absentHost: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  attendees: [
    {
      name: "Jane",
      email: "jane@example.com",
      displayEmail: "jane@example.com",
      timeZone: "Europe/London",
      phoneNumber: "+44 20 7946 0000",
      absent: false,
    },
  ],
  guests: ["sam@example.com"],
  reschedulingReason: "  ",
  bookingFieldsResponses: {},
} satisfies ApiBooking;

// The spec types answers as `never`; at runtime they hold whatever the booking questions collected.
const answersAsSent: Record<string, unknown> = {
  name: "Jane",
  email: "jane@example.com",
  location: { value: "integrations:google:meet", optionValue: "" },
  notes: "Travelling with two kids",
  "arrival-date": "2026-12-01",
  citiesToVisit: ["Penang", "Ipoh", ""],
  "needs-visa": false,
  whatsapp: { value: "+60 12-345 6789", optionValue: "" },
  "empty-answer": "  ",
  unknownShape: { nested: { deep: true } },
};

describe("toBookingDetail", () => {
  it("keeps the people, place and timing the detail screen shows", () => {
    const detail = toBookingDetail(booking);

    expect(detail).toMatchObject({
      uid: "booking-1",
      title: "1-to-1 call with Alan",
      description: "Planning the Penang leg",
      durationMinutes: 60,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      hosts: [{ name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur", noShow: false }],
      attendees: [
        {
          name: "Jane",
          email: "jane@example.com",
          timeZone: "Europe/London",
          phoneNumber: "+44 20 7946 0000",
          noShow: false,
        },
      ],
      guests: ["sam@example.com"],
      eventTypeId: 3,
    });
  });

  it("treats blank reasons as no reason", () => {
    expect(toBookingDetail(booking)).toMatchObject({ reschedulingReason: null, cancellationReason: null });
  });

  it("turns booking question answers into displayable values, skipping ones shown elsewhere", () => {
    expect(bookingAnswers(answersAsSent)).toEqual([
      { field: "notes", value: "Travelling with two kids" },
      { field: "arrival-date", value: "2026-12-01" },
      { field: "citiesToVisit", value: "Penang, Ipoh" },
      { field: "needs-visa", value: false },
      { field: "whatsapp", value: "+60 12-345 6789" },
    ]);
  });

  it("has no booking-level answers for seated bookings", () => {
    const { bookingFieldsResponses: _responses, guests: _guests, ...rest } = booking;
    const seated = {
      ...rest,
      attendees: [
        {
          name: "Sam",
          email: "sam@example.com",
          displayEmail: "sam@example.com",
          timeZone: "Asia/Singapore",
          absent: true,
          seatUid: "seat-1",
          bookingFieldsResponses: {},
        },
      ],
    } satisfies ApiBooking;

    expect(toBookingDetail(seated)).toMatchObject({
      answers: [],
      guests: [],
      attendees: [{ name: "Sam", phoneNumber: null, noShow: true }],
    });
  });
});

describe("pickBooking", () => {
  const occurrence = (uid: string) => ({ ...booking, uid, recurringBookingUid: "series-1" });

  it("returns a single booking as it is", () => {
    expect(pickBooking(booking, "booking-1")).toBe(booking);
  });

  it("finds the requested occurrence in a recurring series", () => {
    expect(pickBooking([occurrence("a"), occurrence("b")], "b")?.uid).toBe("b");
  });

  it("falls back to the series' first occurrence when asked by series uid", () => {
    expect(pickBooking([occurrence("a"), occurrence("b")], "series-1")?.uid).toBe("a");
  });

  it("returns nothing for an empty series", () => {
    expect(pickBooking([], "series-1")).toBeUndefined();
  });
});

describe("fieldNameLabel", () => {
  it.each([
    ["arrival-date", "Arrival date"],
    ["citiesToVisit", "Cities to visit"],
    ["what_you_need_help_with", "What you need help with"],
    ["notes", "Notes"],
  ])("%s → %s", (field, label) => {
    expect(fieldNameLabel(field)).toBe(label);
  });
});
