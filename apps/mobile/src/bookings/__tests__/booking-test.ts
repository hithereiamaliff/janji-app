import { type ApiBooking, toBookingSummary } from "@/bookings/booking";

const base = {
  id: 1,
  uid: "booking-1",
  title: "30 min call between Alan and Jane",
  description: "",
  hosts: [],
  status: "accepted",
  start: "2026-11-06T07:00:00.000Z",
  end: "2026-11-06T07:30:00.000Z",
  duration: 30,
  eventTypeId: 3,
  eventType: { id: 3, slug: "30min" },
  location: "https://meet.google.com/abc-defg-hij",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  absentHost: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  attendees: [
    {
      name: "Jane",
      email: "jane@example.com",
      displayEmail: "jane@example.com",
      timeZone: "Europe/London",
      absent: false,
    },
  ],
  bookingFieldsResponses: {},
} satisfies ApiBooking;

describe("toBookingSummary", () => {
  it("keeps what the list needs from a regular booking", () => {
    expect(toBookingSummary(base)).toEqual({
      uid: "booking-1",
      title: "30 min call between Alan and Jane",
      start: "2026-11-06T07:00:00.000Z",
      end: "2026-11-06T07:30:00.000Z",
      status: "accepted",
      attendees: [{ name: "Jane", email: "jane@example.com" }],
      location: "https://meet.google.com/abc-defg-hij",
      isRecurring: false,
    });
  });

  it.each([
    ["empty", ""],
    ["placeholder", "unknown"],
  ])("treats API v2's %s location as no location", (_kind, location) => {
    expect(toBookingSummary({ ...base, location, meetingUrl: location }).location).toBeNull();
  });

  it("marks occurrences of a recurring booking", () => {
    expect(toBookingSummary({ ...base, recurringBookingUid: "series-1" }).isRecurring).toBe(true);
  });

  it("maps seated bookings' attendees too", () => {
    const seated = {
      ...base,
      attendees: [
        {
          name: "Sam",
          email: "sam@example.com",
          displayEmail: "sam@example.com",
          timeZone: "Asia/Kuala_Lumpur",
          absent: false,
          seatUid: "seat-1",
          bookingFieldsResponses: {},
        },
      ],
    } satisfies ApiBooking;

    expect(toBookingSummary(seated).attendees).toEqual([{ name: "Sam", email: "sam@example.com" }]);
  });
});
