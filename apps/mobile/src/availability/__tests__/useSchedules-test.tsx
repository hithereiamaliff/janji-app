import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useSetDefaultSchedule,
} from "@/availability/useSchedules";
import { QueryProvider } from "@/data/QueryProvider";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { apiSchedule, jsonResponse, schedulesResponse, testAccount } from "@/test-utils/fixtures";

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

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
}

function Schedules() {
  const schedules = useSchedules();
  const create = useCreateSchedule();
  const setDefault = useSetDefaultSchedule();
  const remove = useDeleteSchedule();
  if (!schedules.data) return <Text>loading</Text>;
  return (
    <>
      <Text>
        {schedules.data
          .map((schedule) => `${schedule.name}${schedule.isDefault ? " (default)" : ""}`)
          .join(", ")}
      </Text>
      <Button
        label="New"
        onPress={() => create.mutate({ name: "Evenings", timeZone: "UTC", isDefault: false })}
      />
      <Button label="Make default" onPress={() => setDefault.mutate(3)} />
      <Button label="Delete" onPress={() => remove.mutate(3)} />
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

/** Lists a default schedule and a second one; changes are answered with `changeResponse`. */
async function renderSchedules(changeResponse: () => Response) {
  const requests: string[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    requests.push(request.method);
    if (request.method !== "GET") return changeResponse();
    return schedulesResponse([
      { id: 1, name: "Consultation hours", isDefault: true },
      { id: 3, name: "Weekends" },
    ]);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <Schedules />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  await screen.findByText("Consultation hours (default), Weekends");
  return requests;
}

describe("schedule hooks", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("adds a new schedule to the list", async () => {
    await renderSchedules(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 8, name: "Evenings" }) }, { status: 201 })
    );

    await fireEvent.press(screen.getByRole("button", { name: "New" }));

    expect(await screen.findByText("Consultation hours (default), Weekends, Evenings")).toBeOnTheScreen();
  });

  it("makes another schedule the only default", async () => {
    await renderSchedules(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 3, name: "Weekends", isDefault: true }) })
    );

    await fireEvent.press(screen.getByRole("button", { name: "Make default" }));

    expect(await screen.findByText("Weekends (default), Consultation hours")).toBeOnTheScreen();
  });

  it("takes a deleted schedule off the list", async () => {
    await renderSchedules(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 3, name: "Weekends" }) })
    );

    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Consultation hours (default)")).toBeOnTheScreen();
  });

  it("fetches the list again when a delete fails, in case the schedule was already gone", async () => {
    const requests = await renderSchedules(() =>
      jsonResponse(
        { status: "error", error: { message: "Schedule with ID=3 does not exist." } },
        { status: 400 }
      )
    );

    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(requests).toEqual(["GET", "DELETE", "GET"]));
  });
});
