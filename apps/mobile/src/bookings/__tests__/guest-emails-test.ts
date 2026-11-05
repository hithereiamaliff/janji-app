import type { BookingPerson } from "@/bookings/booking-detail";
import { checkGuestEmails } from "@/bookings/guest-emails";

const jane: BookingPerson = {
  name: "Jane",
  email: "jane+a1b2c3d4e5f6g7h8i9j0k1l2m@example.com",
  displayEmail: "jane@example.com",
  timeZone: "Europe/London",
  phoneNumber: null,
  noShow: false,
};

describe("checkGuestEmails", () => {
  it("reads addresses split by lines, commas, semicolons or spaces, once each", () => {
    expect(
      checkGuestEmails(" lee@example.com,\nkim@example.com; Lee@Example.com  sam@example.com ", [])
    ).toEqual({
      ok: true,
      emails: ["lee@example.com", "kim@example.com", "sam@example.com"],
    });
  });

  it("asks for at least one address", () => {
    expect(checkGuestEmails(" ,\n ", [])).toEqual({ ok: false, problem: "missing" });
  });

  it("names the addresses that don't look right", () => {
    expect(checkGuestEmails("lee@example.com kim@ sam", [])).toEqual({
      ok: false,
      problem: "invalid",
      emails: ["kim@", "sam"],
    });
  });

  it("allows 10 at a time", () => {
    const eleven = Array.from({ length: 11 }, (_, index) => `guest${index}@example.com`).join("\n");

    expect(checkGuestEmails(eleven, [])).toEqual({ ok: false, problem: "too_many" });
  });

  it("names guests who are already on the booking, by either form of their address", () => {
    expect(checkGuestEmails("JANE@example.com lee@example.com", [jane])).toEqual({
      ok: false,
      problem: "already_attending",
      emails: ["JANE@example.com"],
    });
  });
});
