import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";

describe("ScreenScrollView", () => {
  it("starts its content below a see-through header", async () => {
    await render(
      <ScreenScrollView testID="body">
        <Text>Weekly hours</Text>
      </ScreenScrollView>
    );

    expect(screen.getByTestId("body")).toHaveProp("contentInsetAdjustmentBehavior", "automatic");
    expect(screen.getByText("Weekly hours")).toBeOnTheScreen();
  });
});
