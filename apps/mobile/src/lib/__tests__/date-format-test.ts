import { dateTimeFormat } from "@/lib/date-format";

describe("dateTimeFormat", () => {
  it("builds a format once for each locale and set of options, then reuses it", () => {
    const time = dateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

    expect(dateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })).toBe(time);
    expect(dateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })).not.toBe(time);
    expect(dateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })).not.toBe(time);
  });

  it("formats as Intl.DateTimeFormat does", () => {
    const date = new Date(Date.UTC(2026, 10, 5, 17, 30));

    expect(
      dateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date)
    ).toBe("5:30 PM");
  });
});
