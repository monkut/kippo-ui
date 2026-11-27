import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";

export type UseApiQueryOptions = {
  /** Fetch only while true (default). While false: no request, `data` undefined, not loading. */
  enabled?: boolean;
  /** While a refetch is in flight, keep exposing the last settled `data` instead of undefined. */
  keepPreviousData?: boolean;
};

export type UseApiQueryReturn<T> = {
  /** The result for the current `deps`; undefined while loading (unless `keepPreviousData`), on
   * error, or when disabled. */
  data: T | undefined;
  /** The rejection for the current `deps`, or null. */
  error: unknown;
  /** True from the first render with new `deps` (or after `reload`) until that request settles. */
  isLoading: boolean;
  /** Refetch with the current `deps`. */
  reload: () => void;
};

type Settled<T> = { key: DependencyList; data: T | undefined; error: unknown };

const isSameKey = (a: DependencyList, b: DependencyList) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/**
 * Run `fn` when `deps` change and expose its result. A response for superseded `deps` (or
 * arriving after unmount) is dropped, so the latest request always wins.
 *
 * `isLoading` is derived from `deps`, not set in the effect, so there is no render where new
 * `deps` show the previous result or an empty "loaded" state.
 */
export function useApiQuery<T>(
  fn: () => Promise<T>,
  deps: DependencyList,
  { enabled = true, keepPreviousData = false }: UseApiQueryOptions = {},
): UseApiQueryReturn<T> {
  const fnRef = useRef(fn);
  const [reloadCount, setReloadCount] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key: DependencyList = [reloadCount, ...deps];

  // Keep the latest closure without making `fn` a dependency (callers pass an inline arrow).
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) {
      setSettled(null);
      return;
    }
    let cancelled = false;
    // The executor turns a synchronous throw in `fn` into a rejection.
    new Promise<T>((resolve) => resolve(fnRef.current())).then(
      (data) => {
        if (!cancelled) setSettled({ key, data, error: null });
      },
      (error: unknown) => {
        console.error("API query failed:", error);
        if (!cancelled) setSettled({ key, data: undefined, error });
      },
    );
    return () => {
      cancelled = true;
    };
    // `key` is the dependency list: reloadCount + the caller's deps.
  }, [enabled, ...key]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const current = enabled && settled !== null && isSameKey(settled.key, key) ? settled : null;
  return {
    data: current === null && keepPreviousData && enabled ? settled?.data : current?.data,
    error: current?.error ?? null,
    isLoading: enabled && current === null,
    reload,
  };
}
