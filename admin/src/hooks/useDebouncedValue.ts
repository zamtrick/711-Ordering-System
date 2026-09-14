import { useEffect, useState } from "react";

// Returns `value` only after it has stopped changing for `delay` ms.
// Used to debounce server-side search inputs so we don't fire a request
// per keystroke (and avoid out-of-order response races while typing).
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
