import { readPushSetup } from "@/notifications/push-setup";

const extra = { relayOrigin: "https://relay.example", eas: { projectId: "project-1" } };

describe("readPushSetup", () => {
  it("has the relay and the Expo project the build was made with", () => {
    expect(readPushSetup({ os: "ios", extra, easProjectId: undefined })).toEqual({
      platform: "ios",
      relayOrigin: "https://relay.example",
      projectId: "project-1",
    });
  });

  it("takes the project EAS Build stamped in when the config has none", () => {
    expect(
      readPushSetup({
        os: "android",
        extra: { relayOrigin: "https://relay.example" },
        easProjectId: "project-2",
      })
    ).toEqual({ platform: "android", relayOrigin: "https://relay.example", projectId: "project-2" });
  });

  it("keeps only the relay's origin", () => {
    const setup = readPushSetup({
      os: "ios",
      extra: { ...extra, relayOrigin: "https://relay.example/v1/" },
      easProjectId: undefined,
    });

    expect(setup?.relayOrigin).toBe("https://relay.example");
  });

  it.each([
    ["on web", { os: "web", extra, easProjectId: "project-1" }],
    ["without a relay", { os: "ios", extra: { eas: { projectId: "project-1" } }, easProjectId: undefined }],
    [
      "with a relay that isn't HTTPS",
      { os: "ios", extra: { ...extra, relayOrigin: "http://relay.example" } },
    ],
    ["with a relay that isn't an address", { os: "ios", extra: { ...extra, relayOrigin: "relay" } }],
    ["without an Expo project", { os: "android", extra: { relayOrigin: "https://relay.example" } }],
    ["without any extra config", { os: "ios", extra: undefined, easProjectId: "project-1" }],
  ] as const)("has none %s", (_, build) => {
    expect(readPushSetup({ easProjectId: undefined, ...build })).toBeNull();
  });
});
