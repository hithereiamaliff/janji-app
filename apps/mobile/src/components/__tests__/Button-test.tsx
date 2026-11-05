import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "@/components/Button";

describe("Button", () => {
  it("is announced as a button with its label and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("ignores presses and reports itself disabled when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);

    const button = screen.getByRole("button", { name: "Continue" });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it("keeps its accessible name while loading, reports busy and ignores presses", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Continue" });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(screen.queryByText("Continue")).toBeNull();
  });

  it("passes its hint to screen readers", async () => {
    await render(
      <Button label="Open" onPress={jest.fn()} accessibilityHint="Opens your server in a browser" />
    );

    expect(screen.getByHintText("Opens your server in a browser")).toBe(
      screen.getByRole("button", { name: "Open" })
    );
  });
});
