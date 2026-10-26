"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeDataChange } from "@/lib/services/events";

type QueryState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

export interface QueryResult<T> {
  status: QueryState<T>["status"];
  data: T | undefined;
  error: Error | undefined;
  /** Shows the loading state again and refetches. */
  reload: () => void;
}

/**
 * Runs an async service call and exposes loading / success / error state.
 * `fetcher` must be referentially stable (a module-level service function or a
 * `useCallback`). Refetches quietly when a service mutation emits a data-change
 * event, so e.g. a new order appears on the Orders page without a reload.
 */
export function useServiceQuery<T>(fetcher: () => Promise<T>): QueryResult<T> {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (data) => {
        if (!cancelled) setState({ status: "success", data });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", error: error instanceof Error ? error : new Error("Request failed") });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, nonce]);

  useEffect(() => subscribeDataChange(() => setNonce((value) => value + 1)), []);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setNonce((value) => value + 1);
  }, []);

  return {
    status: state.status,
    data: state.status === "success" ? state.data : undefined,
    error: state.status === "error" ? state.error : undefined,
    reload,
  };
}
