import { loadWelcomeSeen, saveWelcomeSeen } from "@/onboarding/welcome-storage";

const mockStore = new Map<string, string>();
let mockFailReads = false;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => {
    if (mockFailReads) throw new Error("Keychain unavailable");
    return mockStore.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

describe("welcome storage", () => {
  beforeEach(() => {
    mockStore.clear();
    mockFailReads = false;
  });

  it("says a new phone hasn't seen the welcome", async () => {
    await expect(loadWelcomeSeen()).resolves.toBe(false);
  });

  it("remembers that the welcome was seen", async () => {
    await saveWelcomeSeen();

    await expect(loadWelcomeSeen()).resolves.toBe(true);
  });

  it("shows the welcome again when storage can't be read", async () => {
    await saveWelcomeSeen();
    mockFailReads = true;

    await expect(loadWelcomeSeen()).resolves.toBe(false);
  });
});
