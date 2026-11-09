import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

export const SOURCE_CODE_URL = "https://github.com/hithereiamaliff/janji-app";
export const PRIVACY_URL = `${SOURCE_CODE_URL}/blob/main/docs/privacy.md`;
export const SUPPORT_URL = `${SOURCE_CODE_URL}/blob/main/docs/support.md`;
export const SERVER_SETUP_URL = `${SOURCE_CODE_URL}/blob/main/docs/server-setup.md`;
/** Cal.diy's own instructions for running it with Docker. */
export const CAL_DIY_DEPLOYMENT_URL = "https://github.com/calcom/cal.diy#deployment";

// Cal.com's own app, for people whose bookings are on Cal.com's cloud. Each platform opens its own store:
// App Review rejects iOS apps that point people at other app stores.
export const CAL_COM_APP_URL = Platform.select({
  android: "https://play.google.com/store/apps/details?id=com.calcom.companion",
  default: "https://apps.apple.com/app/id6757157271",
});

export function openInBrowser(url: string) {
  // Without a browser to open there's nothing more to do; the button stays for another try.
  WebBrowser.openBrowserAsync(url).catch(() => undefined);
}
