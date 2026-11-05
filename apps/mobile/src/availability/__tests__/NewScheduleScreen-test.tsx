import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import en from "@/i18n/locales/en.json";
import { saveSession } from "@/session/account-storage";
import { appRoutes } from "@/test-utils/app-routes";
import {
  apiSchedule,
  jsonResponse,
  schedulesResponse,
  type TestSchedule,
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

const consultation: TestSchedule = { id: 1, name: "Consultation hours", isDefault: true };

/** Opens the new schedule form from the Availability tab. A new schedule is answered with `created`. */
async function openForm(served: TestSchedule[], created: () => Response) {
  const posted: unknown[] = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.method === "POST") {
      posted.push(await request.json());
      return created();
    }
    return schedulesResponse(served);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await renderRouter(appRoutes, { initialUrl: "/availability" });
  await fireEvent.press(await screen.findByRole("button", { name: en.availability.new.action }));
  await screen.findByRole("header", { name: en.availability.new.title });
  return posted;
}

function createdSchedule(schedule: TestSchedule): () => Response {
  return () => jsonResponse({ status: "success", data: apiSchedule(schedule) }, { status: 201 });
}

async function create() {
  await fireEvent.press(screen.getByRole("button", { name: en.availability.new.create }));
}

describe("a new schedule", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("is made in the profile's time zone, then opened", async () => {
    const posted = await openForm([consultation], createdSchedule({ id: 8, name: "Evenings" }));

    expect(
      screen.getByText("It starts with Cal.diy's usual hours: Mon–Fri, 9:00 AM – 5:00 PM.")
    ).toBeOnTheScreen();
    expect(
      screen.getByText("It uses your Cal.diy time zone, Kuala Lumpur (Asia/Kuala_Lumpur).")
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.availability.new.nameLabel), "  Evenings ");
    await create();

    await waitFor(() => expect(screen).toHavePathname("/schedule/8"));
    expect(await screen.findByRole("header", { name: "Evenings" })).toBeOnTheScreen();
    expect(posted).toEqual([{ name: "Evenings", timeZone: "Asia/Kuala_Lumpur", isDefault: false }]);
  });

  it("is the default when it's the first", async () => {
    const posted = await openForm([], createdSchedule({ id: 8, name: "Working hours", isDefault: true }));

    expect(screen.getByText(en.availability.new.firstIsDefault)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.availability.new.nameLabel), "Working hours");
    await create();

    await waitFor(() => expect(posted).toEqual([expect.objectContaining({ isDefault: true })]));
  });

  it("needs a name", async () => {
    const posted = await openForm([consultation], createdSchedule({ id: 8, name: "Evenings" }));

    await fireEvent.changeText(screen.getByLabelText(en.availability.new.nameLabel), "   ");
    await create();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.new.nameMissing);
    expect(posted).toEqual([]);
  });

  it("explains when it couldn't be made", async () => {
    await openForm([consultation], () =>
      jsonResponse({ status: "error", error: { message: "invalid_input" } }, { status: 400 })
    );

    await fireEvent.changeText(screen.getByLabelText(en.availability.new.nameLabel), "Evenings");
    await create();

    expect(await screen.findByRole("alert")).toHaveTextContent(en.availability.new.failed);
    expect(screen).toHavePathname("/schedule/new");
  });
});
