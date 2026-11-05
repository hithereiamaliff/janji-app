import "@/i18n";

import { CalApiError } from "@janji/cal-api/errors";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { LoadErrorState } from "@/components/LoadErrorState";
import en from "@/i18n/locales/en.json";
import { SessionProvider } from "@/session/SessionProvider";

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

async function renderState(error: unknown, notFoundMessage?: string) {
  const onRetry = jest.fn();
  await render(
    <SessionProvider>
      <LoadErrorState
        error={error}
        onRetry={onRetry}
        fallbackMessage="Couldn't load this."
        notFoundMessage={notFoundMessage}
      />
    </SessionProvider>
  );
  return onRetry;
}

describe("LoadErrorState", () => {
  it("explains errors that mean the same on every screen and offers to try again", async () => {
    const onRetry = await renderState(new CalApiError({ kind: "network" }));

    expect(screen.getByRole("alert")).toHaveTextContent(en.loadErrors.network);
    await fireEvent.press(screen.getByRole("button", { name: en.loadErrors.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says what didn't load for other errors", async () => {
    await renderState(new Error("Unexpected token < in JSON"));

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this.");
    expect(screen.getByRole("button", { name: en.loadErrors.retry })).toBeOnTheScreen();
  });

  it("says when something was deleted, with nothing to try again", async () => {
    await renderState(new CalApiError({ kind: "not_found", status: 404 }), "This booking no longer exists.");

    expect(screen.getByRole("alert")).toHaveTextContent("This booking no longer exists.");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("treats not found like other failures on screens without a not-found message", async () => {
    await renderState(new CalApiError({ kind: "not_found", status: 404 }));

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this.");
    expect(screen.getByRole("button", { name: en.loadErrors.retry })).toBeOnTheScreen();
  });
});
