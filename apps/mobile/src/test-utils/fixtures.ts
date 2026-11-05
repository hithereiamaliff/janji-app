import type { Account } from "@/session/account";

// Kept apart from app-routes.ts so unit tests don't load every screen just to get test data.

export const testAccount: Account = {
  serverOrigin: "https://book.example.com",
  apiRootUrl: "https://book.example.com/api",
  user: { id: 7, username: "alan", name: "Alan", email: "alan@example.com", timeZone: "Asia/Kuala_Lumpur" },
};

/** A GET /v2/me body for testAccount. */
export const testMeResponse = {
  status: "success",
  data: {
    id: 7,
    username: "alan",
    email: "alan@example.com",
    name: "Alan",
    avatarUrl: null,
    bio: null,
    timeFormat: 12,
    defaultScheduleId: 1,
    weekStart: "Monday",
    timeZone: "Asia/Kuala_Lumpur",
    organizationId: null,
  },
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}
