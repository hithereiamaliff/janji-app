import { fireEvent, render, screen } from "@testing-library/react-native";

import { LinkButton } from "@/components/LinkButton";

describe("LinkButton", () => {
  it("is announced as a button with its label and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<LinkButton label="What's Janji?" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "What's Janji?" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("says whether what it shows and hides is showing", async () => {
    await render(<LinkButton label="Show advanced options" expanded={false} onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Show advanced options" })).toBeCollapsed();
  });
});
