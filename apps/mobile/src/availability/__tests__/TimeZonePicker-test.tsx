import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";
import { type ReactNode, useState } from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TimeZonePicker } from "@/availability/TimeZonePicker";
import { QueryProvider } from "@/data/QueryProvider";
import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

function Picker() {
  const [zone, setZone] = useState("Europe/London");
  return (
    <>
      <TimeZonePicker value={zone} onChange={setZone} />
      <Text>{`chosen ${zone}`}</Text>
    </>
  );
}

/** Answers /v2/timezones with `response`, then opens the picker. */
async function openPicker(response: () => Response) {
  jest.spyOn(globalThis, "fetch").mockImplementation(async () => response());
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SessionProvider>
        <QueryProvider>
          <WhenSignedIn>
            <Picker />
          </WhenSignedIn>
        </QueryProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Time zone, London (Europe/London)" }));
  expect(screen.getByRole("header", { name: en.timeZonePicker.title })).toBeOnTheScreen();
}

const cityList = () =>
  jsonResponse({
    status: "success",
    data: [
      { city: "Penang", timezone: "Asia/Kuala_Lumpur", pop: 708127 },
      { city: "London", timezone: "Europe/London", pop: 7556900 },
    ],
  });

describe("TimeZonePicker", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("finds a city by name and takes its time zone", async () => {
    await openPicker(cityList);

    expect(screen.getByText(en.timeZonePicker.searchHint)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.timeZonePicker.searchLabel), "pen");
    await fireEvent.press(await screen.findByRole("button", { name: "Penang, Asia/Kuala_Lumpur" }));

    expect(screen.getByText("chosen Asia/Kuala_Lumpur")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: en.timeZonePicker.title })).toBeNull();
  });

  it("marks the time zone already chosen", async () => {
    await openPicker(cityList);

    await fireEvent.changeText(screen.getByLabelText(en.timeZonePicker.searchLabel), "london");

    expect(await screen.findByRole("button", { name: "London, Europe/London" })).toBeSelected();
  });

  it("offers the device's own time zone", async () => {
    await openPicker(cityList);

    // Tests run in UTC.
    await fireEvent.press(screen.getByRole("button", { name: "Use this device's time zone: UTC" }));

    expect(screen.getByText("chosen UTC")).toBeOnTheScreen();
  });

  it("says when nothing matches", async () => {
    await openPicker(cityList);

    await fireEvent.changeText(screen.getByLabelText(en.timeZonePicker.searchLabel), "atlantis");

    expect(await screen.findByText("No city matches “atlantis”.")).toBeOnTheScreen();
  });

  it("offers to try again when the list doesn't load", async () => {
    await openPicker(() => jsonResponse({ status: "error" }, { status: 404 }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.timeZonePicker.loadFailed);
    expect(screen.getByRole("button", { name: en.loadErrors.retry })).toBeOnTheScreen();
  });
});
