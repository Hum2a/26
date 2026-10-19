import { useCallback, useEffect, useRef, useState } from "react";

/** Read-only request lifecycle; live room state remains in its existing provider. */
export function useSection<T extends object>(
  read: () => Promise<T | { error: string }>,
  revision = "",
) {
  const [state, setState] = useState<{
    data?: T;
    error: string;
    loading: boolean;
    checkedAt?: number;
    reader: typeof read;
    revision: string;
  }>({ error: "", loading: true, reader: read, revision });
  const lifetime = useRef({ generation: 0 });
  const load = useCallback(() => {
    const request = ++lifetime.current.generation;
    return Promise.resolve()
      .then(read)
      .then((result) => {
        if (request !== lifetime.current.generation) return;
        if ("error" in result)
          setState((previous) => ({
            ...previous,
            error: result.error,
            loading: false,
            reader: read,
            revision,
          }));
        else
          setState({
            data: result,
            error: "",
            loading: false,
            checkedAt: Date.now(),
            reader: read,
            revision,
          });
      })
      .catch(() => {
        if (request === lifetime.current.generation)
          setState((previous) => ({
            ...previous,
            error: "This information is unavailable. Try again.",
            loading: false,
            reader: read,
            revision,
          }));
      });
  }, [read, revision]);
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    return load();
  }, [load]);
  useEffect(() => {
    const guard = lifetime.current;
    void load();
    return () => {
      guard.generation++;
    };
  }, [load]);
  return {
    ...state,
    loading: state.loading || state.reader !== read || state.revision !== revision,
    refresh,
  };
}
