import { addDays, endOfDay } from "date-fns";
import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiPrivateLink,
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

type Sent = { method: string; body: unknown };

/** Opens the new link form from the consultation's screen. A new link is answered with `created`. */
async function openForm(created: () => Response) {
  const sent: Sent[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    sent.push({ method: request.method, body: text ? JSON.parse(text) : null });
    if (request.method === "POST") return created();
    if (request.url.endsWith("/private-links")) return privateLinksResponse([]);
    return eventTypesResponse([{ id: 2, title: "Consultation", slug: "consultation" }]);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/event-type/2" });
  await fireEvent.press(await screen.findByRole("button", { name: en.privateLinks.new.action }));
  await screen.findByRole("header", { name: en.privateLinks.new.title });
  return sent;
}

function createdLink(link: TestPrivateLink): () => Response {
  return () => jsonResponse({ status: "success", data: apiPrivateLink(link) }, { status: 201 });
}

const posts = (sent: Sent[]) => sent.filter((request) => request.method === "POST").map(({ body }) => body);

async function create() {
  await fireEvent.press(screen.getByRole("button", { name: en.privateLinks.new.create }));
}

describe("a new private link", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());

  it("is single use unless asked otherwise, and is ready to share once made", async () => {
    const sent = await openForm(createdLink({ id: "n3w" }));

    expect(screen.getByLabelText(en.privateLinks.new.bookingsLabel)).toHaveDisplayValue("1");
    await create();

    expect(await screen.findByRole("header", { name: en.privateLinks.new.readyTitle })).toBeOnTheScreen();
    expect(posts(sent)).toEqual([{ maxUsageCount: 1 }]);
    expect(screen.getByText("book.example.com/d/n3w/consultation")).toBeOnTheScreen();
    expect(screen.getByText("1 of 1 booking left")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: en.eventTypes.copyLink }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("https://book.example.com/d/n3w/consultation");

    await fireEvent.press(screen.getByRole("button", { name: en.privateLinks.new.done }));
    await waitFor(() => expect(screen).toHavePathname("/event-type/2"));
    expect(screen.getByText("book.example.com/d/n3w/consultation")).toBeOnTheScreen();
    expect(screen.queryByText(en.privateLinks.none)).toBeNull();
  });

  it("works for as many bookings as asked", async () => {
    const sent = await openForm(createdLink({ id: "n3w", max: 5 }));

    await fireEvent.changeText(screen.getByLabelText(en.privateLinks.new.bookingsLabel), "5");
    await create();

    expect(await screen.findByText("5 of 5 bookings left")).toBeOnTheScreen();
    expect(posts(sent)).toEqual([{ maxUsageCount: 5 }]);
  });

  it("works until the end of the day picked", async () => {
    const lastDay = endOfDay(addDays(new Date(), 14));
    const sent = await openForm(createdLink({ id: "n3w", expiresAt: lastDay.toISOString() }));

    await fireEvent.press(screen.getByRole("tab", { name: en.privateLinks.new.afterADate }));
    expect(screen.getByRole("tab", { name: en.privateLinks.new.oneWeek })).toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: en.privateLinks.new.twoWeeks }));
    expect(screen.getByText(/^It stops working at the end of .+\.$/)).toBeOnTheScreen();
    await create();

    expect(await screen.findByText(/^Works until 11:59 PM on /)).toBeOnTheScreen();
    expect(posts(sent)).toEqual([{ expiresAt: lastDay.toISOString() }]);
  });

  it("checks the number of bookings before asking Cal.diy", async () => {
    const sent = await openForm(createdLink({ id: "n3w" }));

    await fireEvent.changeText(screen.getByLabelText(en.privateLinks.new.bookingsLabel), "0");
    await create();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.privateLinks.new.bookingsInvalid);
    expect(posts(sent)).toEqual([]);
  });

  it("explains when the link couldn't be made", async () => {
    await openForm(() =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );

    await create();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.privateLinks.new.failed);
    expect(screen.getByRole("header", { name: en.privateLinks.new.title })).toBeOnTheScreen();
  });
});
