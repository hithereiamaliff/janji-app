import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TimePicker } from "@/availability/TimePicker";
import en from "@/i18n/locales/en.json";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Picker({ initial }: { initial: string }) {
  const [time, setTime] = useState(initial);
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <TimePicker label="Monday, start" title="Start time" value={time} onChange={setTime} />
      <Text>{`chosen ${time}`}</Text>
    </SafeAreaProvider>
  );
}

async function openPicker(initial: string, shown: string) {
  await render(<Picker initial={initial} />);
  await fireEvent.press(screen.getByRole("button", { name: `Monday, start, ${shown}` }));
  expect(screen.getByRole("header", { name: "Start time" })).toBeOnTheScreen();
}

describe("TimePicker", () => {
  it("shows the time, and changes it to one picked from the list", async () => {
    await openPicker("09:00", "9:00 AM");

    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: "5:30 PM" }));

    expect(screen.getByText("chosen 17:30")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Start time" })).toBeNull();
  });

  it("offers 11:59 PM to end the day", async () => {
    await openPicker("17:00", "5:00 PM");

    await fireEvent.press(screen.getByRole("button", { name: "11:59 PM" }));

    expect(screen.getByText("chosen 23:59")).toBeOnTheScreen();
  });

  it("keeps a time set on the web with another interval among the choices", async () => {
    await openPicker("09:10", "9:10 AM");

    expect(screen.getByRole("button", { name: "9:10 AM" })).toBeSelected();
    expect(screen.getByRole("button", { name: "9:15 AM" })).not.toBeSelected();
  });

  it("changes nothing when cancelled", async () => {
    await openPicker("09:00", "9:00 AM");

    await fireEvent.press(screen.getByRole("button", { name: en.timePicker.cancel }));

    expect(screen.getByText("chosen 09:00")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Start time" })).toBeNull();
  });
});
