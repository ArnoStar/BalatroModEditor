import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface Async<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): void;
}

/** a promise's value for a component: loading, data or error; `reload` asks again */
export function use_async<T>(f: () => Promise<T>, deps: DependencyList): Async<T> {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    f().then(
      (data) => { if (run.current === id) setState({ data, error: null, loading: false }); },
      (error) => { if (run.current === id) setState((s) => ({ data: s.data, error, loading: false })); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
