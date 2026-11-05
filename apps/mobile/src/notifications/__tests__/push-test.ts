import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { askPushPermission, getPushToken, onPushTokenChange, toPushPermission } from "@/notifications/push";

type MockAnswer = { granted: boolean; canAskAgain: boolean; ios?: { status: number } };

let mockCurrent: MockAnswer;
let mockAnswer: MockAnswer;
const mockTokenListeners = new Set<() => void>();

jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  AndroidImportance: { HIGH: 6 },
  getPermissionsAsync: jest.fn(async () => mockCurrent),
  requestPermissionsAsync: jest.fn(async () => mockAnswer),
  setNotificationChannelAsync: jest.fn(async () => null),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: "expo", data: "ExponentPushToken[abc]" })),
  addPushTokenListener: jest.fn((listener: () => void) => {
    mockTokenListeners.add(listener);
    return { remove: () => mockTokenListeners.delete(listener) };
  }),
}));

const { IosAuthorizationStatus } = Notifications;
const ios = (status: number): MockAnswer => ({ granted: false, canAskAgain: true, ios: { status } });
const android = (granted: boolean, canAskAgain: boolean): MockAnswer => ({ granted, canAskAgain });

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("toPushPermission", () => {
  it.each([
    ["iOS allowed", ios(IosAuthorizationStatus.AUTHORIZED), "granted"],
    ["iOS allowed quietly", ios(IosAuthorizationStatus.PROVISIONAL), "granted"],
    ["iOS allowed for a while", ios(IosAuthorizationStatus.EPHEMERAL), "granted"],
    ["iOS not asked yet", ios(IosAuthorizationStatus.NOT_DETERMINED), "canAsk"],
    ["iOS turned off", ios(IosAuthorizationStatus.DENIED), "blocked"],
    ["Android allowed", android(true, false), "granted"],
    ["Android not asked, or asked once", android(false, true), "canAsk"],
    ["Android turned off", android(false, false), "blocked"],
  ])("reads %s", (_, answer, permission) => {
    expect(toPushPermission(answer)).toBe(permission);
  });
});

describe("askPushPermission", () => {
  it("names Android's channel before asking, since Android only asks once there is one", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    mockCurrent = android(false, true);
    mockAnswer = android(true, false);

    await expect(askPushPermission("Bookings")).resolves.toBe("granted");

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", {
      name: "Bookings",
      importance: Notifications.AndroidImportance.HIGH,
    });
    const named = jest.mocked(Notifications.setNotificationChannelAsync).mock.invocationCallOrder[0];
    const asked = jest.mocked(Notifications.requestPermissionsAsync).mock.invocationCallOrder[0];
    expect(named).toBeLessThan(asked ?? 0);
  });

  it("asks iOS for alerts and sounds, and has no channel to name", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    mockCurrent = ios(IosAuthorizationStatus.NOT_DETERMINED);
    mockAnswer = ios(IosAuthorizationStatus.DENIED);

    await expect(askPushPermission("Bookings")).resolves.toBe("blocked");

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it.each([
    ["was allowed", ios(IosAuthorizationStatus.AUTHORIZED), "granted"],
    ["was turned off in the phone's settings", ios(IosAuthorizationStatus.DENIED), "blocked"],
  ])("doesn't ask again when it %s", async (_, current, permission) => {
    mockCurrent = current;

    await expect(askPushPermission("Bookings")).resolves.toBe(permission);

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("getPushToken", () => {
  it("gets the Expo push token for the build's project", async () => {
    await expect(getPushToken("project-1")).resolves.toBe("ExponentPushToken[abc]");

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-1" });
  });
});

describe("onPushTokenChange", () => {
  it("tells the app when the phone's push token changes, until it stops listening", () => {
    const changed = jest.fn();
    const stop = onPushTokenChange(changed);

    for (const listener of mockTokenListeners) listener();
    stop();

    expect(changed).toHaveBeenCalledTimes(1);
    expect(mockTokenListeners.size).toBe(0);
  });
});
