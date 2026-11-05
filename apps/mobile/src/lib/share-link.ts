import { Platform, Share } from "react-native";

/**
 * Opens the system share sheet for a link. iOS shares a url, with a preview; Android only takes a message.
 * Closing the sheet, or a browser without sharing, isn't an error worth showing.
 */
export function shareLink(url: string): void {
  Share.share(Platform.OS === "ios" ? { url } : { message: url }).catch(() => undefined);
}
