import type {
  DeviceStatusResponse,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  RelayError,
  UpdateDeviceRequest,
} from "@janji/shared/relay";

/** A request the relay refused (with its status and error code), or one that didn't reach it (status null). */
export class RelayRequestError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: RelayError["error"] | null
  ) {
    super(
      status === null
        ? "The relay couldn't be reached"
        : `The relay answered ${status}${code ? ` (${code})` : ""}`
    );
    this.name = "RelayRequestError";
  }
}

/** The credentials a phone got when it registered, which the app keeps to change or remove it. */
export type RelayDevice = Pick<RegisterDeviceResponse, "deviceId" | "deviceToken">;

type Fetch = (request: Request) => Promise<Response>;

function errorCode(body: unknown): RelayError["error"] | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const { error } = body;
  return error === "invalid_request" ||
    error === "rate_limited" ||
    error === "unauthorized" ||
    error === "not_found" ||
    error === "push_token_taken"
    ? error
    : null;
}

/** Talks to the relay at `relayOrigin`, which turns Cal.diy's webhooks into this phone's notifications. */
export function createRelayClient(relayOrigin: string, fetchImpl: Fetch = (request) => fetch(request)) {
  const base = relayOrigin.replace(/\/+$/, "");

  async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
    const { token, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("Accept", "application/json");
    if (rest.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try {
      response = await fetchImpl(new Request(`${base}${path}`, { ...rest, headers }));
    } catch {
      throw new RelayRequestError(null, null);
    }
    if (!response.ok)
      throw new RelayRequestError(response.status, errorCode(await response.json().catch(() => null)));
    return response;
  }

  return {
    /** Registers the phone, or registers its push token again, which keeps its hook URL with new credentials. */
    async register(request: RegisterDeviceRequest): Promise<RegisterDeviceResponse> {
      const response = await call("/v1/devices", { method: "POST", body: JSON.stringify(request) });
      return response.json();
    },

    async update(device: RelayDevice, changes: UpdateDeviceRequest): Promise<void> {
      await call(`/v1/devices/${device.deviceId}`, {
        method: "PATCH",
        token: device.deviceToken,
        body: JSON.stringify(changes),
      });
    },

    /** Removes the phone. One the relay no longer has counts as removed. */
    async remove(device: RelayDevice): Promise<void> {
      try {
        await call(`/v1/devices/${device.deviceId}`, { method: "DELETE", token: device.deviceToken });
      } catch (error) {
        if (!(error instanceof RelayRequestError && error.status === 404)) throw error;
      }
    },

    /** Which of these devices the relay still has. */
    async knownDevices(deviceIds: string[]): Promise<string[]> {
      const known: string[] = [];
      // The relay answers for up to 100 at a time.
      for (let start = 0; start < deviceIds.length; start += 100) {
        const response = await call("/v1/devices/status", {
          method: "POST",
          body: JSON.stringify({ deviceIds: deviceIds.slice(start, start + 100) }),
        });
        const body: DeviceStatusResponse = await response.json();
        known.push(...body.known);
      }
      return known;
    },
  };
}

export type RelayClient = ReturnType<typeof createRelayClient>;
