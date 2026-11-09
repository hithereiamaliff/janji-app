import "@/i18n";

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import en from "@/i18n/locales/en.json";
import { ServerStep } from "@/onboarding/ServerStep";

const { server: strings } = en.signIn;

function apiV2Answers() {
  return new Response(JSON.stringify({ status: "success", data: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function renderStep() {
  const onServerFound = jest.fn();
  const onShowWelcome = jest.fn();
  await render(<ServerStep onServerFound={onServerFound} onShowWelcome={onShowWelcome} />);
  return { onServerFound, onShowWelcome };
}

async function submit(address: string) {
  await fireEvent.changeText(screen.getByLabelText(strings.addressLabel), address);
  await fireEvent.press(screen.getByRole("button", { name: strings.continue }));
}

describe("ServerStep", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => jest.restoreAllMocks());

  it("finds the server's Cal API v2 and passes the server on", async () => {
    fetchSpy.mockResolvedValue(apiV2Answers());
    const { onServerFound } = await renderStep();

    await submit("book.example.com");

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://book.example.com/api/v2/timezones");
    expect(onServerFound).toHaveBeenCalledWith({
      serverOrigin: "https://book.example.com",
      apiRootUrl: "https://book.example.com/api",
    });
  });

  it("opens the welcome again with the address typed so far", async () => {
    const { onShowWelcome } = await renderStep();

    await fireEvent.changeText(screen.getByLabelText(strings.addressLabel), "book.example");
    await fireEvent.press(screen.getByRole("button", { name: strings.aboutJanji }));

    expect(onShowWelcome).toHaveBeenCalledWith("book.example");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks the server when the keyboard's Go key is pressed", async () => {
    fetchSpy.mockResolvedValue(apiV2Answers());
    const { onServerFound } = await renderStep();

    const input = screen.getByLabelText(strings.addressLabel);
    await fireEvent.changeText(input, "book.example.com");
    await fireEvent(input, "submitEditing");

    expect(onServerFound).toHaveBeenCalledTimes(1);
  });

  it("asks for an address when the field is empty", async () => {
    const { onServerFound } = await renderStep();

    await submit("  ");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.empty);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onServerFound).not.toHaveBeenCalled();
  });

  it("refuses plain HTTP without contacting the server", async () => {
    await renderStep();

    await submit("http://book.example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.insecure);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains when the server answers but Cal API v2 isn't there", async () => {
    fetchSpy.mockResolvedValue(new Response("<!DOCTYPE html>", { status: 404 }));
    const { onServerFound } = await renderStep();

    await submit("book.example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.not_cal_api);
    expect(onServerFound).not.toHaveBeenCalled();
  });

  it("explains when the server can't be reached", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Network request failed"));
    await renderStep();

    await submit("book.example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.unreachable);
  });

  it("shows the button as busy while checking", async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchSpy.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );
    const { onServerFound } = await renderStep();
    await fireEvent.changeText(screen.getByLabelText(strings.addressLabel), "book.example.com");

    // fireEvent waits for the press handler, which is waiting on the held response, so await it last.
    const pressing = fireEvent.press(screen.getByRole("button", { name: strings.continue }));

    expect(await screen.findByRole("button", { name: strings.continue, busy: true })).toBeOnTheScreen();
    await act(async () => answer(apiV2Answers()));
    await pressing;
    expect(onServerFound).toHaveBeenCalledTimes(1);
  });

  it("uses a separate Cal API v2 address from the advanced options", async () => {
    fetchSpy.mockResolvedValue(apiV2Answers());
    const { onServerFound } = await renderStep();

    const toggle = screen.getByRole("button", { name: strings.advancedShow });
    expect(toggle).toBeCollapsed();
    await fireEvent.press(toggle);
    expect(screen.getByRole("button", { name: strings.advancedHide })).toBeExpanded();
    await fireEvent.changeText(screen.getByLabelText(strings.apiAddressLabel), "https://api.example.com/v2");
    await submit("book.example.com");

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.example.com/v2/timezones");
    expect(onServerFound).toHaveBeenCalledWith({
      serverOrigin: "https://book.example.com",
      apiRootUrl: "https://api.example.com",
    });
  });

  it("shows a bad advanced address under its own field", async () => {
    await renderStep();

    await fireEvent.press(screen.getByRole("button", { name: strings.advancedShow }));
    await fireEvent.changeText(screen.getByLabelText(strings.apiAddressLabel), "ftp://api.example.com");
    await submit("book.example.com");

    expect(screen.getByRole("alert")).toHaveTextContent(strings.errors.api_address_invalid);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
