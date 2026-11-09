import { ScrollView, type ScrollViewProps } from "react-native";

/**
 * The scrolling body of a screen with a stack header. From iOS 26 the header is see-through and the screen
 * starts underneath it, so the content insets itself to begin below the header and above the home indicator.
 * Elsewhere the header takes its own space and nothing changes.
 */
export function ScreenScrollView(props: ScrollViewProps) {
  return <ScrollView contentInsetAdjustmentBehavior="automatic" {...props} />;
}
