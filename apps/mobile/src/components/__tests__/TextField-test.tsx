import { fireEvent, render, screen } from "@testing-library/react-native";

import { TextField } from "@/components/TextField";

describe("TextField", () => {
  it("labels the input for screen readers and reports typing", async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="Server address" placeholder="book.example.com" onChangeText={onChangeText} />
    );

    await fireEvent.changeText(screen.getByLabelText("Server address"), "book.techmavie.digital");

    expect(onChangeText).toHaveBeenCalledWith("book.techmavie.digital");
    expect(screen.getByText("Server address")).toBeOnTheScreen();
  });

  it("shows a hint under the field and reads it as the input's hint", async () => {
    await render(<TextField label="API key" hint="Starts with cal_" />);

    expect(screen.getByText("Starts with cal_")).toBeOnTheScreen();
    expect(screen.getByHintText("Starts with cal_")).toBeOnTheScreen();
  });

  it("announces an error as an alert", async () => {
    await render(<TextField label="Server address" error="Enter your server's address." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter your server's address.");
  });

  it("shows no alert without an error", async () => {
    await render(<TextField label="Server address" error={null} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
