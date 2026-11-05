import type { Account } from "@/session/account";
import { clearSavedSession, loadSavedSession, saveSession } from "@/session/account-storage";

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

describe("account storage", () => {
  beforeEach(() => mockStore.clear());

  it("returns null when nothing is saved", async () => {
    await expect(loadSavedSession()).resolves.toBeNull();
  });

  it("saves and restores the account and API key", async () => {
    await saveSession({ account, apiKey: "cal_secret" });

    await expect(loadSavedSession()).resolves.toEqual({ account, apiKey: "cal_secret" });
  });

  it("keeps the API key out of the stored account record", async () => {
    await saveSession({ account, apiKey: "cal_secret" });

    expect(mockStore.get("janji.account")).not.toContain("cal_secret");
  });

  it("clears both entries on sign-out", async () => {
    await saveSession({ account, apiKey: "cal_secret" });

    await clearSavedSession();

    expect(mockStore.size).toBe(0);
    await expect(loadSavedSession()).resolves.toBeNull();
  });

  it.each([
    ["a key without an account", () => mockStore.set("janji.apiKey", "cal_secret")],
    ["an account without a key", () => mockStore.set("janji.account", JSON.stringify(account))],
    [
      "a corrupted account",
      () => {
        mockStore.set("janji.apiKey", "cal_secret");
        mockStore.set("janji.account", "{not json");
      },
    ],
    [
      "an account in an unknown shape",
      () => {
        mockStore.set("janji.apiKey", "cal_secret");
        mockStore.set("janji.account", JSON.stringify({ serverOrigin: "https://book.example.com" }));
      },
    ],
  ])("discards %s and asks for a new sign-in", async (_case, arrange) => {
    arrange();

    await expect(loadSavedSession()).resolves.toBeNull();
    expect(mockStore.size).toBe(0);
  });
});
