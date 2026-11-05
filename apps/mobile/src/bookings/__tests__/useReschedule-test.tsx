import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { changedHereRecently } from "@/bookings/recent-changes";
import { useBooking } from "@/bookings/useBooking";
import { useBookings } from "@/bookings/useBookings";
import { useRescheduleBooking } from "@/bookings/useReschedule";
import { QueryProvider } from "@/data/QueryProvider";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import {
  apiBooking,
  bookingResponse,
  bookingsResponse,
  jsonResponse,
  type TestBooking,
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

const booking: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
};

type Sent = { method: string; path: string; body: unknown };

function serve(sent: Sent[]) {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const text = await request.text();
    const path = new URL(request.url).pathname;
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : null });
    if (path === "/api/v2/bookings") return bookingsResponse([booking]);
    if (path.endsWith("/reschedule")) {
      return jsonResponse({
        status: "success",
        data: apiBooking({ ...booking, uid: "b2", start: "2026-11-07T08:00:00Z" }),
      });
    }
    return bookingResponse(booking);
  });
}

function Rescheduler() {
  const current = useBooking("b1");
  useBookings("upcoming");
  const reschedule = useRescheduleBooking("b1");
  if (!current.data) return <Text>loading</Text>;
  return (
    <>
      <Text>{reschedule.data ? `moved to ${reschedule.data}` : current.data.start}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => reschedule.mutate({ start: "2026-11-07T08:00:00Z" })}
      >
        <Text>Move</Text>
      </Pressable>
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

describe("useRescheduleBooking", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("moves the booking as the signed-in host, then refreshes the lists", async () => {
    const sent: Sent[] = [];
    serve(sent);
    await saveSession({ account: testAccount, apiKey: "cal_secret" });
    await render(
      <SessionProvider>
        <QueryProvider>
          <WhenSignedIn>
            <Rescheduler />
          </WhenSignedIn>
        </QueryProvider>
      </SessionProvider>
    );
    await screen.findByText(booking.start);

    await fireEvent.press(screen.getByRole("button", { name: "Move" }));

    expect(await screen.findByText("moved to b2")).toBeOnTheScreen();
    expect(sent.find((request) => request.method === "POST")?.body).toEqual({
      start: "2026-11-07T08:00:00.000Z",
      rescheduledBy: testAccount.user.email,
    });
    await waitFor(() =>
      expect(sent.filter((request) => request.path === "/api/v2/bookings")).toHaveLength(2)
    );
    // Cal.diy's notification names the new booking, and the relay adds the one it replaced.
    expect(changedHereRecently("b1")).toBe(true);
    expect(changedHereRecently("b2")).toBe(true);
  });
});
