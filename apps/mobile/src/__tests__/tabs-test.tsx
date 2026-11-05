import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import RootLayout from "@/app/_layout";
import TabsLayout from "@/app/(tabs)/_layout";
import AvailabilityScreen from "@/app/(tabs)/availability";
import EventTypesScreen from "@/app/(tabs)/event-types";
import BookingsScreen from "@/app/(tabs)/index";
import SettingsScreen from "@/app/(tabs)/settings";
import en from "@/i18n/locales/en.json";

const routes = {
  _layout: RootLayout,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/index": BookingsScreen,
  "(tabs)/event-types": EventTypesScreen,
  "(tabs)/availability": AvailabilityScreen,
  "(tabs)/settings": SettingsScreen,
};

// React Navigation labels each tab button "<title>, tab, <n> of <count>" for screen readers.
function getTabButton(title: string) {
  return screen.getByRole("button", { name: new RegExp(`^${title}, tab`) });
}

describe("tab navigation", () => {
  it("opens on the Bookings tab", async () => {
    await renderRouter(routes);

    expect(screen).toHavePathname("/");
    expect(screen.getByText(en.placeholder.bookings)).toBeVisible();
    expect(getTabButton(en.tabs.bookings)).toBeSelected();
  });

  it("gives every tab an accessible, translated label", async () => {
    await renderRouter(routes);

    for (const title of Object.values(en.tabs)) {
      expect(getTabButton(title)).toBeOnTheScreen();
    }
  });

  it("switches to Settings when its tab is pressed", async () => {
    await renderRouter(routes);

    await fireEvent.press(getTabButton(en.tabs.settings));

    expect(screen).toHavePathname("/settings");
    expect(screen.getByText(en.placeholder.settings)).toBeVisible();
    expect(getTabButton(en.tabs.settings)).toBeSelected();
  });
});
