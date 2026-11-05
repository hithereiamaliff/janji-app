import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { QueryProvider } from "@/data/QueryProvider";
import { saveSession } from "@/session/account-storage";
import { type SessionContextValue, SessionProvider, useSession } from "@/session/SessionProvider";
import { testAccount } from "@/test-utils/fixtures";

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

let latestSession: SessionContextValue | null = null;
let latestQueryClient: QueryClient | null = null;

function Probe() {
  latestSession = useSession();
  latestQueryClient = useQueryClient();
  return <Text>{latestSession.session.status}</Text>;
}

function cachedQueries() {
  return latestQueryClient?.getQueryCache().getAll() ?? [];
}

describe("QueryProvider", () => {
  beforeEach(() => mockStore.clear());

  it("keeps cached data while signed in and drops all of it on sign-out", async () => {
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    await render(
      <SessionProvider>
        <QueryProvider>
          <Probe />
        </QueryProvider>
      </SessionProvider>
    );
    await screen.findByText("signedIn");

    await act(async () => {
      latestQueryClient?.setQueryData(["bookings", "account", "upcoming", ""], { pages: [], pageParams: [] });
    });
    expect(cachedQueries()).toHaveLength(1);

    await act(async () => {
      await latestSession?.signOut();
    });

    expect(await screen.findByText("signedOut")).toBeOnTheScreen();
    expect(cachedQueries()).toHaveLength(0);
  });
});
