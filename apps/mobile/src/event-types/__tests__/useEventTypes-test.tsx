import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { QueryProvider } from "@/data/QueryProvider";
import { useEventTypes, useSetEventTypeHidden, useUpdateEventType } from "@/event-types/useEventTypes";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { apiEventType, eventTypesResponse, jsonResponse, testAccount } from "@/test-utils/fixtures";

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

const consultation = { id: 2, title: "Consultation", slug: "consultation", hidden: true };

function EventTypes() {
  const eventTypes = useEventTypes();
  const setHidden = useSetEventTypeHidden();
  const update = useUpdateEventType(2);
  if (!eventTypes.data) return <Text>loading</Text>;
  return (
    <>
      {eventTypes.data.map((eventType) => (
        <Text key={eventType.id}>{`${eventType.title}: ${eventType.hidden ? "hidden" : "shown"}`}</Text>
      ))}
      {setHidden.isError ? <Text>failed</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => setHidden.mutate({ id: 2, hidden: false })}>
        <Text>Show</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => update.mutate({ title: "Discovery call" })}>
        <Text>Rename</Text>
      </Pressable>
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

/** Lists the consultation and answers a change with `patchResponse`, but only once the returned release is called. */
async function renderEventTypes(patchResponse: () => Response) {
  let release = () => {};
  const patched = new Promise<void>((resolve) => {
    release = resolve;
  });
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.method !== "PATCH") return eventTypesResponse([consultation]);
    await patched;
    return patchResponse();
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <EventTypes />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  await screen.findByText("Consultation: hidden");
  return () => release();
}

describe("useSetEventTypeHidden", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows the change straight away and keeps what the server returns", async () => {
    const release = await renderEventTypes(() =>
      jsonResponse({ status: "success", data: apiEventType({ ...consultation, hidden: false }) })
    );

    await fireEvent.press(screen.getByRole("button", { name: "Show" }));

    expect(await screen.findByText("Consultation: shown")).toBeOnTheScreen();
    release();
    expect(await screen.findByText("Consultation: shown")).toBeOnTheScreen();
  });

  it("puts it back when the server refuses", async () => {
    const release = await renderEventTypes(() =>
      jsonResponse({ status: "error", error: { message: "Forbidden" } }, { status: 403 })
    );

    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("Consultation: shown")).toBeOnTheScreen();
    release();

    expect(await screen.findByText("failed")).toBeOnTheScreen();
    expect(screen.getByText("Consultation: hidden")).toBeOnTheScreen();
  });
});

describe("useUpdateEventType", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows the event type as the server saved it", async () => {
    const release = await renderEventTypes(() =>
      jsonResponse({ status: "success", data: apiEventType({ ...consultation, title: "Discovery call" }) })
    );

    await fireEvent.press(screen.getByRole("button", { name: "Rename" }));
    release();

    expect(await screen.findByText("Discovery call: hidden")).toBeOnTheScreen();
    expect(screen.queryByText("Consultation: hidden")).toBeNull();
  });
});
