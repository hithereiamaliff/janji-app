import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Share } from "react-native";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  eventTypesResponse,
  jsonResponse,
  privateLinksResponse,
  type TestPrivateLink,
  testAccount,
} from "@/test-utils/fixtures";

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

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));

const links: TestPrivateLink[] = [
  { id: "used-up", used: 1, max: 1, expired: true },
  { id: "single", used: 0, max: 1 },
  { id: "ended", expiresAt: "2026-11-01T15:59:59.999Z", expired: true },
  { id: "five", used: 2, max: 5 },
  { id: "next-week", expiresAt: "2026-11-12T15:59:59.999Z" },
];

type Sent = { method: string; path: string };

/** Opens the consultation's screen. Deleting a link is answered with `deleteResponse`, or as done. */
async function renderPrivateLinks(listResponse: () => Response, deleteResponse?: () => Response) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    sent.push({ method: request.method, path });
    if (request.method === "DELETE") {
      return deleteResponse?.() ?? jsonResponse({ status: "success", data: { linkId: "single" } });
    }
    if (path.endsWith("/private-links")) return listResponse();
    return eventTypesResponse([{ id: 2, title: "Consultation", slug: "consultation" }]);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/event-type/2" });
  await screen.findByRole("header", { name: en.privateLinks.title });
  return sent;
}

const deletes = (sent: Sent[]) => sent.filter((request) => request.method === "DELETE");

/** The buttons of the link with this status, which screen readers hear as each button's hint. */
function buttonsFor(status: string) {
  const buttons = screen.getAllByHintText(status);
  const remove = buttons.at(-1);
  if (!remove) throw new Error(`No buttons for the link that says "${status}"`);
  return { copy: buttons[0], share: buttons[1], remove };
}

describe("private links", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("lists each link with how long it keeps working, those that still work first", async () => {
    await renderPrivateLinks(() => privateLinksResponse(links));

    expect(await screen.findByText("book.example.com/d/next-week/consultation")).toBeOnTheScreen();
    expect(
      screen
        .getAllByText(/^(Works until|Stopped working|\d+ of \d+ booking|Its |All )/)
        .map((text) => text.props.children)
    ).toEqual([
      "Works until 3:59 PM on Nov 12, 2026",
      "1 of 1 booking left",
      "3 of 5 bookings left",
      "Its 1 booking has been made",
      "Stopped working at 3:59 PM on Nov 1, 2026",
    ]);
    expect(screen.getAllByText(en.privateLinks.expired)).toHaveLength(2);
    // Links that no longer work can only be deleted.
    expect(screen.getAllByRole("button", { name: en.privateLinks.copy })).toHaveLength(3);
    expect(screen.getAllByHintText("Its 1 booking has been made")).toHaveLength(1);
    expect(buttonsFor("Its 1 booking has been made").remove).toHaveTextContent(en.privateLinks.delete);
  });

  it("copies or shares a link", async () => {
    const share = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await renderPrivateLinks(() => privateLinksResponse(links));
    const link = "https://book.example.com/d/next-week/consultation";
    await screen.findByText("book.example.com/d/next-week/consultation");
    const buttons = buttonsFor("Works until 3:59 PM on Nov 12, 2026");

    if (!buttons.copy || !buttons.share) throw new Error("No Copy or Share button");
    await fireEvent.press(buttons.copy);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(link);
    expect(await screen.findByText(en.eventTypes.linkCopied)).toBeOnTheScreen();

    await fireEvent.press(buttons.share);
    expect(share).toHaveBeenCalledWith({ url: link });
  });

  it("deletes a link only once asked to again, then takes it off the list", async () => {
    const sent = await renderPrivateLinks(() =>
      privateLinksResponse([{ id: "single" }, { id: "five", max: 5 }])
    );
    await screen.findByText("book.example.com/d/single/consultation");

    await fireEvent.press(buttonsFor("1 of 1 booking left").remove);
    expect(screen.getByText(en.privateLinks.deleteQuestion)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.privateLinks.keep }));
    expect(screen.queryByText(en.privateLinks.deleteQuestion)).toBeNull();
    expect(deletes(sent)).toEqual([]);

    await fireEvent.press(buttonsFor("1 of 1 booking left").remove);
    await fireEvent.press(screen.getByRole("button", { name: en.privateLinks.deleteConfirm }));

    await waitFor(() => expect(screen.queryByText("book.example.com/d/single/consultation")).toBeNull());
    expect(screen.getByText("5 of 5 bookings left")).toBeOnTheScreen();
    expect(deletes(sent)).toEqual([{ method: "DELETE", path: "/api/v2/event-types/2/private-links/single" }]);
  });

  it("explains a failed delete and keeps the link", async () => {
    await renderPrivateLinks(
      () => privateLinksResponse([{ id: "single" }]),
      () => jsonResponse({ status: "error", error: { message: "Forbidden" } }, { status: 403 })
    );

    await fireEvent.press(await screen.findByRole("button", { name: en.privateLinks.delete }));
    await fireEvent.press(screen.getByRole("button", { name: en.privateLinks.deleteConfirm }));

    expect(await screen.findByRole("alert")).toHaveTextContent(en.privateLinks.deleteFailed);
    expect(screen.getByText("book.example.com/d/single/consultation")).toBeOnTheScreen();
  });

  it("says when there are none", async () => {
    await renderPrivateLinks(() => privateLinksResponse([]));

    expect(await screen.findByText(en.privateLinks.none)).toBeOnTheScreen();
  });

  it("explains when the links don't load", async () => {
    await renderPrivateLinks(() =>
      jsonResponse({ status: "error", error: { message: "Forbidden" } }, { status: 403 })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(en.privateLinks.loadFailed);
    expect(screen.getByRole("button", { name: en.loadErrors.retry })).toBeOnTheScreen();
  });
});
