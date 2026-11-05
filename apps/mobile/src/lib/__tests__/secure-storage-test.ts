import * as SecureStore from "expo-secure-store";

import * as nativeStorage from "@/lib/secure-storage";
import * as webStorage from "@/lib/secure-storage.web";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("secure storage (native)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delegates to expo-secure-store", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue("cal_secret");

    await nativeStorage.setSecureItem("account.apiKey", "cal_secret");
    await expect(nativeStorage.getSecureItem("account.apiKey")).resolves.toBe("cal_secret");
    await nativeStorage.deleteSecureItem("account.apiKey");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("account.apiKey", "cal_secret");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("account.apiKey");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("account.apiKey");
  });

  it("rejects keys expo-secure-store would refuse, before calling it", async () => {
    await expect(nativeStorage.setSecureItem("api key", "x")).rejects.toThrow("Invalid secure storage key");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("secure storage (web shim)", () => {
  it("stores, reads and deletes values in memory", async () => {
    await expect(webStorage.getSecureItem("account.apiKey")).resolves.toBeNull();

    await webStorage.setSecureItem("account.apiKey", "cal_secret");
    await expect(webStorage.getSecureItem("account.apiKey")).resolves.toBe("cal_secret");

    await webStorage.deleteSecureItem("account.apiKey");
    await expect(webStorage.getSecureItem("account.apiKey")).resolves.toBeNull();
  });

  it("rejects the same invalid keys as the native store", async () => {
    await expect(webStorage.setSecureItem("api/key", "x")).rejects.toThrow("Invalid secure storage key");
  });
});
