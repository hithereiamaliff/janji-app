import {
  clearPushRegistration,
  loadPushRegistration,
  type PushRegistration,
  savePushRegistration,
} from "@/notifications/registration-storage";

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

const registration: PushRegistration = {
  serverOrigin: "https://book.example.com",
  userId: 7,
  relayOrigin: "https://relay.example",
  deviceId: "AAAAAAAAAAAAAAAAAAAAAA",
  deviceToken: "device-secret",
  webhookId: 12,
  expoPushToken: "ExponentPushToken[abc]",
  locale: "en-MY",
};

describe("push registration storage", () => {
  beforeEach(() => mockStore.clear());

  it("has nothing until notifications are turned on", async () => {
    await expect(loadPushRegistration()).resolves.toBeNull();
  });

  it("keeps the registration in secure storage", async () => {
    await savePushRegistration(registration);

    expect(mockStore.has("janji.notifications")).toBe(true);
    await expect(loadPushRegistration()).resolves.toEqual(registration);
  });

  it("forgets it when notifications are turned off", async () => {
    await savePushRegistration(registration);

    await clearPushRegistration();

    expect(mockStore.size).toBe(0);
    await expect(loadPushRegistration()).resolves.toBeNull();
  });

  it.each([
    ["isn't JSON", "{not json"],
    ["isn't a registration", JSON.stringify(["AAAAAAAAAAAAAAAAAAAAAA"])],
    ["misses a field", JSON.stringify({ ...registration, webhookId: undefined })],
  ])("deletes one that %s, since it can't be used", async (_, stored) => {
    mockStore.set("janji.notifications", stored);

    await expect(loadPushRegistration()).resolves.toBeNull();
    expect(mockStore.size).toBe(0);
  });
});
