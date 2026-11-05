import "@/i18n";

import { render, screen } from "@testing-library/react-native";
import { BookingRow } from "@/bookings/BookingRow";
import type { BookingSummary } from "@/bookings/booking";

const booking: BookingSummary = {
  uid: "booking-1",
  title: "1-to-1 call with Alan",
  start: "2026-11-06T07:00:00Z",
  end: "2026-11-06T08:00:00Z",
  status: "accepted",
  attendees: [{ name: "Jane", email: "jane@example.com" }],
  location: null,
  meetingUrl: null,
  isRecurring: false,
};

async function renderRow(overrides: Partial<BookingSummary> = {}) {
  await render(<BookingRow booking={{ ...booking, ...overrides }} locale="en-US" />);
}

describe("BookingRow", () => {
  it("shows the time range, title and attendee", async () => {
    await renderRow();

    expect(screen.getByText("7:00 AM – 8:00 AM")).toBeOnTheScreen();
    expect(screen.getByText("1-to-1 call with Alan")).toBeOnTheScreen();
    expect(screen.getByText("with Jane")).toBeOnTheScreen();
  });

  it.each([
    [[], null],
    [
      [
        { name: "Jane", email: "jane@example.com" },
        { name: "Sam", email: "sam@example.com" },
      ],
      "with Jane and Sam",
    ],
    [
      [
        { name: "Jane", email: "jane@example.com" },
        { name: "Sam", email: "sam@example.com" },
        { name: "Lee", email: "lee@example.com" },
      ],
      "with Jane and 2 others",
    ],
  ])("names the attendees briefly (%#)", async (attendees, expected) => {
    await renderRow({ attendees });

    if (expected === null) {
      expect(screen.queryByText(/^with /)).toBeNull();
    } else {
      expect(screen.getByText(expected)).toBeOnTheScreen();
    }
  });

  it.each([
    ["pending", "Unconfirmed"],
    ["cancelled", "Cancelled"],
    ["rejected", "Declined"],
  ] as const)("labels %s bookings", async (status, label) => {
    await renderRow({ status });

    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it("shows no status label for accepted bookings", async () => {
    await renderRow();

    for (const label of ["Unconfirmed", "Cancelled", "Declined"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("reads as one item to screen readers, status and series included", async () => {
    await renderRow({ status: "pending", isRecurring: true });

    expect(
      screen.getByLabelText("7:00 AM – 8:00 AM, 1-to-1 call with Alan, with Jane, Repeats, Unconfirmed")
    ).toBeOnTheScreen();
    expect(screen.getByText("with Jane · Repeats")).toBeOnTheScreen();
  });
});
