import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import type { Account } from "@/session/account";
import { loadSavedSession, saveSession } from "@/session/account-storage";
import { type SessionContextValue, SessionProvider, useSession } from "@/session/SessionProvider";

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

const account: Account = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
  user: { id: 1, username: "alan", name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur" },
};

let latest: SessionContextValue | null = null;

function current(): SessionContextValue {
  if (!latest) throw new Error("SessionProvider hasn't rendered yet");
  return latest;
}

function SessionProbe() {
  latest = useSession();
  const { session } = latest;
  return (
    <Text>
      {session.status === "signedIn" ? `signed in as ${session.account.user.username}` : session.status}
    </Text>
  );
}

async function renderSession() {
  await render(
    <SessionProvider>
      <SessionProbe />
    </SessionProvider>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    mockStore.clear();
    latest = null;
  });

  afterEach(() => jest.restoreAllMocks());

  it("is signed out when nothing is saved", async () => {
    await renderSession();

    expect(await screen.findByText("signedOut")).toBeOnTheScreen();
    expect(current().calClient).toBeNull();
  });

  it("restores a saved session on start", async () => {
    await saveSession({ account, apiKey: "cal_saved" });

    await renderSession();

    expect(await screen.findByText("signed in as alan")).toBeOnTheScreen();
    expect(current().calClient).not.toBeNull();
  });

  it("saves the session on sign-in and clears it on sign-out", async () => {
    await renderSession();
    await screen.findByText("signedOut");

    await act(() => current().signIn(account, "cal_new"));

    expect(screen.getByText("signed in as alan")).toBeOnTheScreen();
    await expect(loadSavedSession()).resolves.toEqual({ account, apiKey: "cal_new" });

    await act(() => current().signOut());

    expect(screen.getByText("signedOut")).toBeOnTheScreen();
    expect(current().calClient).toBeNull();
    await expect(loadSavedSession()).resolves.toBeNull();
  });

  it("replaces the signed-in person's details and saves them with the key", async () => {
    await saveSession({ account, apiKey: "cal_saved" });
    await renderSession();
    await screen.findByText("signed in as alan");
    const user = { ...account.user, username: "alan-r", timeZone: "Europe/London" };

    await act(() => current().updateUser(user));

    expect(screen.getByText("signed in as alan-r")).toBeOnTheScreen();
    await expect(loadSavedSession()).resolves.toEqual({ account: { ...account, user }, apiKey: "cal_saved" });
  });

  it("gives screens a client that sends the signed-in account's key", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: [] }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    await renderSession();
    await screen.findByText("signedOut");
    await act(() => current().signIn(account, "cal_new"));

    await current().calClient?.GET("/v2/schedules");

    const request = fetchSpy.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (request instanceof Request) {
      expect(request.url).toBe("https://book.example.com/api/v2/schedules");
      expect(request.headers.get("Authorization")).toBe("Bearer cal_new");
      expect(request.headers.get("cal-api-version")).toBe("2024-06-11");
    }
  });

  it("refuses to be used outside the provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(render(<SessionProbe />)).rejects.toThrow(
      "useSession must be used inside <SessionProvider>."
    );
  });
});
