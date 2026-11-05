import { timeoutManager } from "@tanstack/react-query";

function unref(timer: unknown): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
}

// TanStack Query keeps unused data for five minutes behind a timer, scheduled when a test's components
// unmount. Unref'd timers still fire during a run but no longer keep Jest alive after the last test.
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    unref(timer);
    return timer;
  },
  clearTimeout: (timer) => clearTimeout(timer),
  setInterval: (callback, delay) => {
    const timer = setInterval(callback, delay);
    unref(timer);
    return timer;
  },
  clearInterval: (timer) => clearInterval(timer),
});
