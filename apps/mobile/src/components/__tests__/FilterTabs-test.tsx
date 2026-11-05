import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterTabs } from "@/components/FilterTabs";

const options = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

describe("FilterTabs", () => {
  it("presents the options as named tabs with the current one selected", async () => {
    await render(
      <FilterTabs
        options={options}
        value="upcoming"
        onChange={jest.fn()}
        accessibilityLabel="Which bookings to show"
      />
    );

    // The group isn't `accessible` itself (that would merge its tabs into one element for VoiceOver), so
    // role queries skip it; check that it carries the tablist role and name instead.
    expect(screen.getByLabelText("Which bookings to show")).toHaveProp("accessibilityRole", "tablist");
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Past" })).not.toBeSelected();
  });

  it("reports the tab that was pressed", async () => {
    const onChange = jest.fn();
    await render(
      <FilterTabs
        options={options}
        value="upcoming"
        onChange={onChange}
        accessibilityLabel="Which bookings to show"
      />
    );

    await fireEvent.press(screen.getByRole("tab", { name: "Past" }));

    expect(onChange).toHaveBeenCalledWith("past");
  });
});
