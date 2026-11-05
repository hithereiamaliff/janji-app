import { loadRelayChoice, relayOriginFrom, saveRelayChoice } from "@/notifications/relay-setting";

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

describe("relayOriginFrom", () => {
  it.each([
    ["https://relay.example", "https://relay.example"],
    ["https://relay.example/v1/", "https://relay.example"],
    ["  relay.example  ", "https://relay.example"],
    ["janji-push.example.com:8443", "https://janji-push.example.com:8443"],
  ])("reads %j as %s", (address, origin) => {
    expect(relayOriginFrom(address)).toBe(origin);
  });

  it.each([["http://relay.example"], ["relay"], ["ftp://relay.example"], [""], [42]])(
    "refuses %j",
    (address) => {
      expect(relayOriginFrom(address)).toBeNull();
    }
  );
});

describe("the relay chosen under Advanced", () => {
  beforeEach(() => mockStore.clear());

  it("is kept until it's set back to the build's", async () => {
    await expect(loadRelayChoice()).resolves.toBeNull();

    await saveRelayChoice("https://my-relay.example");
    await expect(loadRelayChoice()).resolves.toBe("https://my-relay.example");

    await saveRelayChoice(null);
    await expect(loadRelayChoice()).resolves.toBeNull();
    expect(mockStore.size).toBe(0);
  });
});
