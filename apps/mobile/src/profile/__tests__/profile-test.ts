import { createCalClient } from "@janji/cal-api/client";

import { type ApiProfile, toProfile } from "@/profile/profile";
import { fetchProfile, updateProfile } from "@/profile/profile-api";
import { jsonResponse, testMeResponse } from "@/test-utils/fixtures";

const me: ApiProfile = testMeResponse.data;

describe("toProfile", () => {
  it("keeps what the app shows and follows", () => {
    expect(toProfile(me)).toEqual({
      name: "Alan",
      email: "alan@example.com",
      username: "alan",
      timeZone: "Asia/Kuala_Lumpur",
      timeFormat: 12,
      weekStart: 1,
    });
    expect(toProfile({ ...me, timeFormat: 24 }).timeFormat).toBe(24);
  });

  it.each([
    ["Sunday", 0],
    ["Monday", 1],
    ["Saturday", 6],
  ])("starts weeks on %s as day %i", (weekStart, day) => {
    expect(toProfile({ ...me, weekStart }).weekStart).toBe(day);
  });

  it("starts weeks on Sunday, Cal.diy's default, for a day it doesn't know", () => {
    expect(toProfile({ ...me, weekStart: "Someday" }).weekStart).toBe(0);
  });
});

describe("fetchProfile", () => {
  it("reads /v2/me, which takes no API version", async () => {
    const sent: { path: string; version: string | null }[] = [];
    const client = createCalClient({
      apiRootUrl: "https://book.example.com/api",
      getApiKey: () => "cal_secret",
      fetch: async (request) => {
        sent.push({ path: new URL(request.url).pathname, version: request.headers.get("cal-api-version") });
        return jsonResponse({ ...testMeResponse, data: { ...me, weekStart: "Sunday" } });
      },
    });

    expect(await fetchProfile(client)).toMatchObject({ timeZone: "Asia/Kuala_Lumpur", weekStart: 0 });
    expect(sent).toEqual([{ path: "/api/v2/me", version: null }]);
  });
});

describe("updateProfile", () => {
  it("sends only the changes, with the week start as Cal.diy names it", async () => {
    const sent: { method: string; path: string; version: string | null; body: unknown }[] = [];
    const client = createCalClient({
      apiRootUrl: "https://book.example.com/api",
      getApiKey: () => "cal_secret",
      fetch: async (request) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname,
          version: request.headers.get("cal-api-version"),
          body: await request.json(),
        });
        return jsonResponse({
          ...testMeResponse,
          data: { ...me, timeZone: "Europe/London", weekStart: "Sunday" },
        });
      },
    });

    const saved = await updateProfile(client, { timeZone: "Europe/London", weekStart: 0 });

    expect(sent).toEqual([
      {
        method: "PATCH",
        path: "/api/v2/me",
        version: null,
        body: { timeZone: "Europe/London", weekStart: "Sunday" },
      },
    ]);
    expect(saved).toMatchObject({ timeZone: "Europe/London", weekStart: 0 });
  });
});
