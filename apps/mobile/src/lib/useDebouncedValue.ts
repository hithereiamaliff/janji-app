import { useEffect, useState } from "react";

/** Follows `value` once it has stopped changing for `delayMs`, e.g. to search after typing pauses. */
export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
