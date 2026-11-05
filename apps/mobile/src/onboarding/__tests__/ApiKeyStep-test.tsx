import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";

import en from "@/i18n/locales/en.json";
import { ApiKeyStep } from "@/onboarding/ApiKeyStep";
import type { Server } from "@/session/account";
import { SessionProvider } from "@/session/SessionProvider";

const mockStore = new Map<string, string>();
let mockFailWrites = false;

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (mockFailWrites) throw new Error("Keychain unavailable");
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "opened" })) }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(async () => "") }));

const { apiKey: strings } = en.signIn;
const server: Server = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

const ME = {
  status: "success",
  data: {
    id: 7,
    username: "alan",
    email: "alan@example.com",
    name: "Alan",
    avatarUrl: null,
    bio: null,
    timeFormat: 12,
    defaultScheduleId: 1,
    weekStart: "Monday",
    timeZone: "Asia/Kuala_Lumpur",
    organizationId: null,
  },
};

async function renderStep() {
  const onChangeServer = jest.fn();
  await render(
    <SessionProvider>
      <ApiKeyStep server={server} onChangeServer={onChangeServer} />
    </SessionProvider>
  );
  return { onChangeServer };
}

async function signInWith(apiKey: string) {
  await fireEvent.changeText(screen.getByLabelText(strings.keyLabel), apiKey);
  await fireEvent.press(screen.getByRole("button", { name: strings.signIn }));
}

describe("ApiKeyStep", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    mockStore.clear();
    mockFailWrites = false;
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => jest.restoreAllMocks());

  it("says which server the key is for", async () => {
    await renderStep();

    expect(screen.getByText(/to book\.example\.com with an API key/)).toBeOnTheScreen();
  });

  it("opens the server's API keys page", async () => {
    await renderStep();

    await fireEvent.press(screen.getByRole("button", { name: strings.openApiKeys }));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://book.example.com/settings/developer/api-keys"
    );
  });

  it("signs in with a pasted key and keeps it in secure storage", async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue("  cal_secret\n");
    fetchSpy.mockResolvedValue(json(ME));
    await renderStep();

    await fireEvent.press(screen.getByRole("button", { name: strings.paste }));
    expect(screen.getByLabelText(strings.keyLabel)).toHaveDisplayValue("cal_secret");
    await fireEvent.press(screen.getByRole("button", { name: strings.signIn }));

    const request = fetchSpy.mock.calls[0]?.[0];
    expect(request instanceof Request && request.headers.get("Authorization")).toBe("Bearer cal_secret");
    expect(mockStore.get("janji.apiKey")).toBe("cal_secret");
    expect(JSON.parse(mockStore.get("janji.account") ?? "{}")).toMatchObject({
      serverOrigin: "https://book.example.com",
      user: { username: "alan", timeZone: "Asia/Kuala_Lumpur" },
    });
  });

  it("leaves the field alone when the clipboard is empty", async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue("   ");
    await renderStep();

    await fireEvent.press(screen.getByRole("button", { name: strings.paste }));

    expect(screen.getByLabelText(strings.keyLabel)).toHaveDisplayValue("");
  });

  it("asks for a key before checking anything", async () => {
    await renderStep();

    await signInWith("");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.empty);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains a key that doesn't work and stays signed out", async () => {
    fetchSpy.mockResolvedValue(
      json({ status: "error", error: { message: "Your api key is not valid" } }, { status: 401 })
    );
    await renderStep();

    await signInWith("cal_wrong");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.unauthorized);
    expect(mockStore.size).toBe(0);
  });

  it("says how long to wait when rate limited", async () => {
    fetchSpy.mockResolvedValue(
      json(
        { status: "error", error: { message: "Too Many Requests" } },
        { status: 429, headers: { "X-RateLimit-Reset-Default": "30" } }
      )
    );
    await renderStep();

    await signInWith("cal_secret");

    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again in 30 seconds.");
  });

  it("reports when the key can't be saved on the device", async () => {
    mockFailWrites = true;
    fetchSpy.mockResolvedValue(json(ME));
    await renderStep();

    await signInWith("cal_secret");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.save_failed);
    expect(screen.getByRole("button", { name: strings.signIn })).not.toBeBusy();
  });

  it("goes back to change the server", async () => {
    const { onChangeServer } = await renderStep();

    await fireEvent.press(screen.getByRole("button", { name: strings.changeServer }));

    expect(onChangeServer).toHaveBeenCalledTimes(1);
  });
});
