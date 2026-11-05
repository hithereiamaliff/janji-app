import "@/i18n";

import { t } from "i18next";

import { clockTime, daysText, weeklyHoursText } from "@/availability/hours-text";
import en from "@/i18n/locales/en.json";

describe("daysText", () => {
  it.each([
    [["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "Mon–Fri"],
    [["Monday", "Tuesday", "Friday", "Saturday", "Sunday"], "Mon, Tue, Fri–Sun"],
    [["Saturday", "Sunday"], "Sat, Sun"],
    [["Wednesday"], "Wed"],
    [["Monday", "Wednesday", "Friday"], "Mon, Wed, Fri"],
    [["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "Mon–Sun"],
  ] as const)("writes %j as %j", (days, text) => {
    expect(daysText(days, "en-US")).toBe(text);
  });

  it("follows the week's order, whatever order the days come in", () => {
    expect(daysText(["Friday", "Monday", "Thursday", "Wednesday", "Tuesday"], "en-US")).toBe("Mon–Fri");
  });

  it("names the days in the person's language", () => {
    expect(daysText(["Monday", "Tuesday", "Wednesday"], "ms-MY")).toBe("Isn–Rab");
  });
});

describe("clockTime", () => {
  it("shows the time as it is on the schedule's clock, in the locale's style", () => {
    expect(clockTime("10:00", "en-US")).toBe("10:00 AM");
    expect(clockTime("18:30", "en-US")).toBe("6:30 PM");
    expect(clockTime("18:30", "en-GB")).toBe("18:30");
  });
});

describe("weeklyHoursText", () => {
  it("gives a line for each set of hours", () => {
    expect(
      weeklyHoursText(
        t,
        [
          {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            startTime: "09:00",
            endTime: "17:00",
          },
          { days: ["Saturday"], startTime: "10:00", endTime: "13:00" },
        ],
        "en-US"
      )
    ).toEqual(["Mon–Fri, 9:00 AM – 5:00 PM", "Sat, 10:00 AM – 1:00 PM"]);
  });

  it("says when there are no weekly hours", () => {
    expect(weeklyHoursText(t, [], "en-US")).toEqual([en.availability.noWeeklyHours]);
  });
});
