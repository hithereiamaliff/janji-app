import { loadPushSetup, readPushBuild } from "@/notifications/push-setup";

const mockStore = new Map<string, string>();
let mockExtra: unknown;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
    easConfig: null,
  },
}));

const extra = { relayOrigin: "https://relay.example", eas: { projectId: "project-1" } };

describe("readPushBuild", () => {
  it("has the Expo project and relay the build was made with", () => {
    expect(readPushBuild({ os: "ios", extra, easProjectId: undefined })).toEqual({
      platform: "ios",
      projectId: "project-1",
      relayOrigin: "https://relay.example",
    });
  });

  it("takes the project EAS Build stamped in when the config has none", () => {
    expect(
      readPushBuild({
        os: "android",
        extra: { relayOrigin: "https://relay.example" },
        easProjectId: "project-2",
      })
    ).toMatchObject({ platform: "android", projectId: "project-2" });
  });

  it.each([
    ["without one", { eas: { projectId: "project-1" } }],
    ["that isn't HTTPS", { ...extra, relayOrigin: "http://relay.example" }],
    ["that isn't an address", { ...extra, relayOrigin: "relay" }],
  ])("has no relay of its own when made with one %s", (_, config) => {
    expect(readPushBuild({ os: "ios", extra: config, easProjectId: undefined })?.relayOrigin).toBeNull();
  });

  it.each([
    ["on web", { os: "web", extra, easProjectId: "project-1" }],
    ["without an Expo project", { os: "android", extra: { relayOrigin: "https://relay.example" } }],
  ] as const)("has none %s", (_, build) => {
    expect(readPushBuild({ easProjectId: undefined, ...build })).toBeNull();
  });
});

// jest-expo runs as iOS.
describe("loadPushSetup", () => {
  beforeEach(() => mockStore.clear());

  it("uses the build's relay", async () => {
    mockExtra = extra;

    await expect(loadPushSetup()).resolves.toEqual({
      platform: "ios",
      projectId: "project-1",
      relayOrigin: "https://relay.example",
    });
  });

  it("uses the relay chosen under Advanced instead", async () => {
    mockExtra = extra;
    mockStore.set("janji.relayOrigin", "https://my-relay.example");

    await expect(loadPushSetup()).resolves.toMatchObject({ relayOrigin: "https://my-relay.example" });
  });

  it("has none without a relay at all", async () => {
    mockExtra = { eas: { projectId: "project-1" } };

    await expect(loadPushSetup()).resolves.toBeNull();
  });
});
