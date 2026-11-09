import { getSecureItem, setSecureItem } from "@/lib/secure-storage";

const WELCOME_KEY = "janji.welcomeSeen";

/** Whether this phone has shown the welcome before. When storage can't say, it hasn't, so the welcome shows. */
export async function loadWelcomeSeen(): Promise<boolean> {
  try {
    return (await getSecureItem(WELCOME_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function saveWelcomeSeen(): Promise<void> {
  await setSecureItem(WELCOME_KEY, "1");
}
