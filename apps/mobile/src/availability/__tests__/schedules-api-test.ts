import { createCalClient } from "@janji/cal-api/client";

import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  setDefaultSchedule,
} from "@/availability/schedules-api";
import { apiSchedule, jsonResponse, schedulesResponse } from "@/test-utils/fixtures";

type SentRequest = { method: string; path: string; version: string | null; body: unknown };

function clientAnswering(response: () => Response) {
  const sent: SentRequest[] = [];
  const client = createCalClient({
    apiRootUrl: "https://book.example.com/api",
    getApiKey: () => "cal_secret",
    fetch: async (request) => {
      const text = await request.text();
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname,
        version: request.headers.get("cal-api-version"),
        body: text ? JSON.parse(text) : null,
      });
      return response();
    },
  });
  return { client, sent };
}

describe("fetchSchedules", () => {
  it("loads the schedules, the default first", async () => {
    const { client, sent } = clientAnswering(() =>
      schedulesResponse([
        { id: 3, name: "Weekends" },
        { id: 1, name: "Consultation hours", isDefault: true },
      ])
    );

    const schedules = await fetchSchedules(client);

    expect(sent).toEqual([{ method: "GET", path: "/api/v2/schedules", version: "2024-06-11", body: null }]);
    expect(schedules.map(({ name }) => name)).toEqual(["Consultation hours", "Weekends"]);
  });
});

describe("createSchedule", () => {
  it("makes a schedule with a name and a time zone", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 5, name: "Weekends" }) }, { status: 201 })
    );

    const created = await createSchedule(client, {
      name: "Weekends",
      timeZone: "Asia/Kuala_Lumpur",
      isDefault: false,
    });

    expect(sent).toEqual([
      {
        method: "POST",
        path: "/api/v2/schedules",
        version: "2024-06-11",
        body: { name: "Weekends", timeZone: "Asia/Kuala_Lumpur", isDefault: false },
      },
    ]);
    expect(created).toMatchObject({ id: 5, name: "Weekends", isDefault: false });
  });
});

describe("setDefaultSchedule", () => {
  it("changes only which schedule is the default", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 3, name: "Weekends", isDefault: true }) })
    );

    const saved = await setDefaultSchedule(client, 3);

    expect(sent).toEqual([
      { method: "PATCH", path: "/api/v2/schedules/3", version: "2024-06-11", body: { isDefault: true } },
    ]);
    expect(saved.isDefault).toBe(true);
  });
});

describe("deleteSchedule", () => {
  it("deletes the schedule", async () => {
    const { client, sent } = clientAnswering(() =>
      jsonResponse({ status: "success", data: apiSchedule({ id: 3, name: "Weekends" }) })
    );

    await deleteSchedule(client, 3);

    expect(sent).toEqual([
      { method: "DELETE", path: "/api/v2/schedules/3", version: "2024-06-11", body: null },
    ]);
  });
});
