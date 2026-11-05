/** Where the app talks to: the web app's origin and the root that Cal API v2 paths are appended to. */
export type Server = {
  serverOrigin: string;
  apiRootUrl: string;
};

export type AccountUser = {
  id: number;
  username: string;
  name: string | null;
  email: string;
  timeZone: string;
};

/** The signed-in account. The API key is stored separately and never kept in this object. */
export type Account = Server & {
  user: AccountUser;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks data read back from storage, which may come from an older app version or be corrupted. */
export function isAccount(value: unknown): value is Account {
  if (!isRecord(value) || !isRecord(value.user)) return false;
  const { user } = value;
  return (
    typeof value.serverOrigin === "string" &&
    typeof value.apiRootUrl === "string" &&
    typeof user.id === "number" &&
    typeof user.username === "string" &&
    (user.name === null || typeof user.name === "string") &&
    typeof user.email === "string" &&
    typeof user.timeZone === "string"
  );
}
