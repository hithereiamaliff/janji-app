import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { QueryProvider } from "@/data/QueryProvider";
import { useCreatePrivateLink, useDeletePrivateLink, usePrivateLinks } from "@/event-types/usePrivateLinks";
import { saveSession } from "@/session/account-storage";
import { SessionProvider, useSession } from "@/session/SessionProvider";
import { apiPrivateLink, jsonResponse, privateLinksResponse, testAccount } from "@/test-utils/fixtures";

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

function PrivateLinks() {
  const links = usePrivateLinks(2);
  const create = useCreatePrivateLink(2);
  const remove = useDeletePrivateLink(2);
  if (!links.data) return <Text>loading</Text>;
  return (
    <>
      <Text>{links.data.map((link) => link.id).join(", ") || "none"}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => create.mutate({ kind: "date", expiresAt: new Date("2026-11-12T15:59:59.999Z") })}
      >
        <Text>Create</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => remove.mutate("single-use")}>
        <Text>Delete</Text>
      </Pressable>
    </>
  );
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return session.status === "signedIn" ? children : <Text>{session.status}</Text>;
}

/** Lists one single-use link, and answers a new link or a deletion as Cal.diy does. */
async function renderPrivateLinks() {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    if (request.method === "POST") {
      return jsonResponse(
        {
          status: "success",
          data: apiPrivateLink({ id: "next-week", expiresAt: "2026-11-12T15:59:59.999Z" }),
        },
        { status: 201 }
      );
    }
    if (request.method === "DELETE") {
      return jsonResponse({ status: "success", data: { linkId: "single-use", message: "Deleted" } });
    }
    return privateLinksResponse([{ id: "single-use" }]);
  });
  await saveSession({ account: testAccount, apiKey: "cal_secret" });
  await render(
    <SessionProvider>
      <QueryProvider>
        <WhenSignedIn>
          <PrivateLinks />
        </WhenSignedIn>
      </QueryProvider>
    </SessionProvider>
  );
  await screen.findByText("single-use");
}

describe("private link hooks", () => {
  beforeEach(() => mockStore.clear());
  afterEach(() => jest.restoreAllMocks());

  it("adds a new link to the list, in its place", async () => {
    await renderPrivateLinks();

    await fireEvent.press(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("next-week, single-use")).toBeOnTheScreen();
  });

  it("takes a deleted link off the list", async () => {
    await renderPrivateLinks();

    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("none")).toBeOnTheScreen();
  });
});
