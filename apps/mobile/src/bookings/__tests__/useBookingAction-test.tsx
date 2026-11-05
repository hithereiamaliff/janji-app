import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { confirmBooking } from "@/bookings/booking-actions";
import { useBooking } from "@/bookings/useBooking";
import { useBookingAction } from "@/bookings/useBookingAction";
import { useBookings } from "@/bookings/useBookings";
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

const pending: TestBooking = {
  uid: "b1",
  title: "Itinerary review",
  start: "2026-11-06T08:00:00Z",
  end: "2026-11-06T09:00:00Z",
  status: "pending",
};

type Requests = { method: string; path: string }[];

function serve(requests: Requests, confirmResponse: () => Response) {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const { pathname } = new URL(request.url);
    requests.push({ method: request.method, path: pathname });
    if (pathname === "/api/v2/bookings") return bookingsResponse([pending]);
    if (pathname.endsWith("/confirm")) return confirmResponse();
    return bookingResponse(pending);
  });
}

function BookingWithConfirm() {
  const booking = useBooking("b1");
  const confirm = useBookingAction("b1", confirmBooking);
  useBookings("unconfirmed");
  if (!booking.data) return <Text>loading</Text>;
  return (
    <>
      <Text>{booking.data.status}</Text>
      {confirm.isError ? <Text>failed</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => confirm.mutate()}>
        <Text>Confirm</Text>
      </Pressable>
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

async function renderBooking() {
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <BookingWithConfirm />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  await screen.findByText("pending");
}

describe("useBookingAction", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("shows the booking as the server returns it, and refreshes the lists", async () => {
    const requests: Requests = [];
    serve(requests, () =>
      jsonResponse({ status: "success", data: apiBooking({ ...pending, status: "accepted" }) })
    );
    await renderBooking();

    await fireEvent.press(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("accepted")).toBeOnTheScreen();
    await waitFor(() =>
      expect(requests.filter((request) => request.path === "/api/v2/bookings")).toHaveLength(2)
    );
    // The confirm response already had the booking, so it isn't fetched again.
    expect(requests.filter((request) => request.path === "/api/v2/bookings/b1")).toHaveLength(1);
  });

  it("sends an action once, even when it fails", async () => {
    const requests: Requests = [];
    serve(requests, () =>
      jsonResponse({ status: "error", error: { message: "Bad Gateway" } }, { status: 502 })
    );
    await renderBooking();

    await fireEvent.press(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("failed")).toBeOnTheScreen();
    expect(requests.filter((request) => request.method === "POST")).toHaveLength(1);
    expect(screen.getByText("pending")).toBeOnTheScreen();
  });
});
