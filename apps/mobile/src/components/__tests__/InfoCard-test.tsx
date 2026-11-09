import { fireEvent, render, screen } from "@testing-library/react-native";

import { InfoCard } from "@/components/InfoCard";

describe("InfoCard", () => {
  it("shows its title as a header, then its body", async () => {
    await render(<InfoCard title="Get a server" body="A Linux server with Docker." />);

    expect(screen.getByRole("header", { name: "Get a server" })).toBeOnTheScreen();
    expect(screen.getByText("A Linux server with Docker.")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("numbers a step", async () => {
    await render(<InfoCard step={2} title="Install Cal.diy" body="Follow Cal.diy's guide." />);

    expect(screen.getByRole("header", { name: "2. Install Cal.diy" })).toBeOnTheScreen();
  });

  it("offers its action as a button", async () => {
    const onPress = jest.fn();
    await render(
      <InfoCard
        title="Install Cal.diy"
        body="Follow Cal.diy's guide."
        action={{ label: "Open the guide", onPress }}
      />
    );

    await fireEvent.press(screen.getByRole("button", { name: "Open the guide" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
