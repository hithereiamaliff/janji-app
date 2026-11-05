import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import { DateCalendar } from "@/components/DateCalendar";
import en from "@/i18n/locales/en.json";

type CalendarProps = {
  initial?: string[];
  minDate?: string;
  disabledDates?: string[];
  weekStart?: number;
};

/** Picks several dates, as the override editor does: pressing a picked date unpicks it. */
function Calendar({ initial = [], minDate, disabledDates, weekStart = 1 }: CalendarProps) {
  const [picked, setPicked] = useState(initial);
  return (
    <>
      <DateCalendar
        selected={picked}
        onPress={(date) =>
          setPicked((current) =>
            current.includes(date) ? current.filter((each) => each !== date) : [...current, date]
          )
        }
        today="2026-11-05"
        minDate={minDate}
        disabledDates={disabledDates}
        weekStart={weekStart}
      />
      <Text>{`picked ${picked.join(" ") || "none"}`}</Text>
    </>
  );
}

const day = (name: string) => screen.getByRole("button", { name });

describe("DateCalendar", () => {
  it("opens on today's month, with today marked for screen readers", async () => {
    await render(<Calendar />);

    expect(screen.getByText("November 2026")).toBeOnTheScreen();
    expect(day("Today, Thursday, November 5, 2026")).toBeOnTheScreen();
    expect(day("Sunday, November 1, 2026")).toBeOnTheScreen();
    expect(day("Monday, November 30, 2026")).toBeOnTheScreen();
  });

  it("opens on the month of the first date picked", async () => {
    await render(<Calendar initial={["2027-01-15"]} />);

    expect(screen.getByText("January 2027")).toBeOnTheScreen();
    expect(day("Friday, January 15, 2027")).toBeSelected();
  });

  it("picks and unpicks dates", async () => {
    await render(<Calendar />);

    await fireEvent.press(day("Tuesday, November 24, 2026"));
    await fireEvent.press(day("Wednesday, November 25, 2026"));

    expect(screen.getByText("picked 2026-11-24 2026-11-25")).toBeOnTheScreen();
    expect(day("Tuesday, November 24, 2026")).toBeSelected();

    await fireEvent.press(day("Tuesday, November 24, 2026"));

    expect(screen.getByText("picked 2026-11-25")).toBeOnTheScreen();
    expect(day("Tuesday, November 24, 2026")).not.toBeSelected();
  });

  it("starts the week on the day it's given", async () => {
    await render(<Calendar weekStart={0} />);

    const columns = screen.getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/, { includeHiddenElements: true });
    expect(columns.map((column) => column.props.children)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });

  it("doesn't let earlier or blocked dates be picked, or earlier months be shown", async () => {
    await render(<Calendar minDate="2026-11-05" disabledDates={["2026-11-20"]} />);

    expect(day("Wednesday, November 4, 2026")).toBeDisabled();
    expect(day("Friday, November 20, 2026")).toBeDisabled();
    expect(day("Saturday, November 21, 2026")).toBeEnabled();
    expect(day(en.calendar.previousMonth)).toBeDisabled();

    await fireEvent.press(day("Wednesday, November 4, 2026"));
    await fireEvent.press(day("Friday, November 20, 2026"));

    expect(screen.getByText("picked none")).toBeOnTheScreen();
  });

  it("moves a month at a time", async () => {
    await render(<Calendar minDate="2026-11-05" />);

    await fireEvent.press(day(en.calendar.nextMonth));
    await fireEvent.press(day(en.calendar.nextMonth));

    expect(screen.getByText("January 2027")).toBeOnTheScreen();
    await fireEvent.press(day("Friday, January 1, 2027"));
    expect(screen.getByText("picked 2027-01-01")).toBeOnTheScreen();

    await fireEvent.press(day(en.calendar.previousMonth));

    expect(screen.getByText("December 2026")).toBeOnTheScreen();
    expect(day(en.calendar.previousMonth)).toBeEnabled();
  });
});
