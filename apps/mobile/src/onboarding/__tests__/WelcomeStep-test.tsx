import "@/i18n";

import { fireEvent, render, screen } from "@testing-library/react-native";

import en from "@/i18n/locales/en.json";
import { WelcomeStep } from "@/onboarding/WelcomeStep";

const strings = en.welcome;

describe("WelcomeStep", () => {
  it("says what Janji is for and who makes it", async () => {
    await render(<WelcomeStep onGetStarted={jest.fn()} />);

    expect(screen.getByRole("header", { name: strings.title })).toBeOnTheScreen();
    expect(screen.getByText(strings.tagline)).toBeOnTheScreen();
    for (const { title, body } of Object.values(strings.points)) {
      expect(screen.getByLabelText(`${title}. ${body}`)).toBeOnTheScreen();
    }
    expect(screen.getByText(strings.independent)).toBeOnTheScreen();
  });

  it("moves on when Get started is pressed", async () => {
    const onGetStarted = jest.fn();
    await render(<WelcomeStep onGetStarted={onGetStarted} />);

    await fireEvent.press(screen.getByRole("button", { name: strings.getStarted }));

    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });
});
