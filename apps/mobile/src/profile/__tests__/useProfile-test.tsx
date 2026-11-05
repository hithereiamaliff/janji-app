import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { useSchedules } from "@/availability/useSchedules";
import { QueryProvider } from "@/data/QueryProvider";
import { useProfile, useUpdateProfile } from "@/profile/useProfile";
import { loadSavedSession, saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { jsonResponse, schedulesResponse, testAccount, testMeResponse } from "@/test-utils/fixtures";

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

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

function Profile() {
  const { session } = useSession();
  const profile = useProfile();
  const update = useUpdateProfile();
  useSchedules();
  if (session.status !== "signedIn" || !profile.data) return <Text>loading</Text>;
  return (
    <>
      <Text>{`profile in ${profile.data.timeZone}, account in ${session.account.user.timeZone}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => update.mutate({ timeZone: "Asia/Singapore" })}>
        <Text>Move to Singapore</Text>
      </Pressable>
    </>
  );
}

/** Serves the profile with `me` until it's changed, and counts the schedule loads. */
async function renderProfile(me: typeof testMeResponse.data) {
  const counts = { schedules: 0 };
  let current = me;
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.url.endsWith("/v2/me")) {
      if (request.method === "PATCH") current = { ...current, ...(await request.json()) };
      return jsonResponse({ ...testMeResponse, data: current });
    }
    counts.schedules += 1;
    return schedulesResponse([]);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <Profile />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  return counts;
}

describe("the profile", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("brings the account's copy of the person's details up to date, and saves it", async () => {
    await renderProfile({ ...testMeResponse.data, timeZone: "Europe/London", username: "alan-r" });

    expect(await screen.findByText("profile in Europe/London, account in Europe/London")).toBeOnTheScreen();
    await waitFor(async () =>
      expect((await loadSavedSession())?.account.user).toEqual({
        ...testAccount.user,
        timeZone: "Europe/London",
        username: "alan-r",
      })
    );
  });

  it("saves a change, then reloads the schedules when the time zone moved", async () => {
    const counts = await renderProfile(testMeResponse.data);
    await screen.findByText("profile in Asia/Kuala_Lumpur, account in Asia/Kuala_Lumpur");
    await waitFor(() => expect(counts.schedules).toBe(1));

    await fireEvent.press(screen.getByRole("button", { name: "Move to Singapore" }));

    expect(await screen.findByText("profile in Asia/Singapore, account in Asia/Singapore")).toBeOnTheScreen();
    await waitFor(() => expect(counts.schedules).toBe(2));
  });
});
