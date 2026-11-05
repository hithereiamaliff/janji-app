import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { useBookings } from "@/bookings/useBookings";
import { QueryProvider } from "@/data/QueryProvider";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { jsonResponse, testAccount } from "@/test-utils/fixtures";

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

function bookingsPage(uids: string[], hasNextPage: boolean) {
  return jsonResponse({
    status: "success",
    data: uids.map((uid) => ({
      id: 1,
      uid,
      title: `Booking ${uid}`,
      description: "",
      hosts: [],
      status: "accepted",
      start: "2026-11-06T07:00:00.000Z",
      end: "2026-11-06T07:30:00.000Z",
      duration: 30,
      eventTypeId: 3,
      eventType: { id: 3, slug: "30min" },
      location: "",
      absentHost: false,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      attendees: [],
      bookingFieldsResponses: {},
    })),
    pagination: {
      totalItems: 3,
      remainingItems: hasNextPage ? 1 : 0,
      returnedItems: uids.length,
      itemsPerPage: 20,
      currentPage: 1,
      totalPages: 2,
      hasNextPage,
      hasPreviousPage: false,
    },
  });
}

// Two pages of upcoming bookings: a and b, then c.
function fakeBookingsServer(input: RequestInfo | URL): Response {
  const url = new URL(input instanceof Request ? input.url : String(input));
  return url.searchParams.get("skip") === "0" ? bookingsPage(["a", "b"], true) : bookingsPage(["c"], false);
}

let latestQueryClient: QueryClient | null = null;

function QueryClientProbe() {
  latestQueryClient = useQueryClient();
  return null;
}

function UpcomingBookings() {
  const { bookings, isPending, hasNextPage, fetchNextPage } = useBookings("upcoming");
  if (isPending) return <Text>loading</Text>;
  return (
    <>
      {bookings.map((booking) => (
        <Text key={booking.uid}>{booking.title}</Text>
      ))}
      {hasNextPage ? (
        <Pressable accessibilityRole="button" onPress={() => fetchNextPage()}>
          <Text>more</Text>
        </Pressable>
      ) : (
        <Text>end</Text>
      )}
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

async function renderBookings() {
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <QueryClientProbe />
        <WhenSignedIn>
          <UpcomingBookings />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
}

describe("useBookings", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => fakeBookingsServer(input));
  });

  afterEach(() => jest.restoreAllMocks());

  it("loads bookings a page at a time, in order", async () => {
    await renderBookings();

    expect(await screen.findByText("Booking a")).toBeOnTheScreen();
    expect(screen.getByText("Booking b")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "more" }));

    expect(await screen.findByText("Booking c")).toBeOnTheScreen();
    expect(screen.getByText("end")).toBeOnTheScreen();
  });

  it("keys cached bookings by the signed-in account", async () => {
    await renderBookings();
    await screen.findByText("Booking a");

    expect(
      latestQueryClient
        ?.getQueryCache()
        .getAll()
        .map((query) => query.queryKey)
    ).toEqual([["bookings", "https://book.example.com#7", "upcoming", ""]]);
  });
});
