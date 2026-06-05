import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Run an async function and track {data, loading, error} in one place.
 * `run` executes the task imperatively (e.g. on button click) and also
 * returns the resolved value; `reset` clears state. Stale results from a
 * superseded call are ignored.
 */
export function useAsync<T, A extends unknown[] = []>(
  task: (...args: A) => Promise<T>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const callId = useRef(0);
  const mounted = useRef(true);
  // Always call the latest task (it closes over current props/state like weights/days).
  const taskRef = useRef(task);
  taskRef.current = task;
  // Set to true on (re)mount so React 18 StrictMode's mount→unmount→remount in dev
  // doesn't leave `mounted` stuck at false (which would drop the final setState and
  // keep `loading` true forever).
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(
    async (...args: A): Promise<T | undefined> => {
      const id = ++callId.current;
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const data = await taskRef.current(...args);
        if (mounted.current && id === callId.current) {
          setState({ data, loading: false, error: null });
        }
        return data;
      } catch (e) {
        if (mounted.current && id === callId.current) {
          setState({
            data: null,
            loading: false,
            error: e instanceof Error ? e.message : 'Неизвестная ошибка',
          });
        }
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), []);
  const setData = useCallback((data: T | null) => setState(s => ({ ...s, data })), []);

  return { ...state, run, reset, setData };
}
