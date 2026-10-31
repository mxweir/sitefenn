import type { Readiness } from "../shared/readiness.js";
import {
  useEffect,
  useState,
  useRef,
  createContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  emptyRoute,
  parseWorkspaceRoute,
  workspaceSearch,
  type WorkspaceRoute,
} from "../shared/workspace-route.js";
export const WorkspaceReadiness = createContext<Readiness | undefined>(
  undefined,
);
export function useWorkspaceRoute() {
  const [route, setRoute] = useState(() =>
    parseWorkspaceRoute(window.location.search),
  );
  const last = useRef(workspaceSearch(route));
  useEffect(() => {
    const pop = () => {
      const next = parseWorkspaceRoute(window.location.search);
      last.current = workspaceSearch(next);
      setRoute(next);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const search = workspaceSearch(route);
    if (last.current === search) return;
    last.current = search;
    if (search !== window.location.search)
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${search}`,
      );
  }, [route]);
  const navigate = (
    patch:
      | Partial<WorkspaceRoute>
      | ((old: WorkspaceRoute) => Partial<WorkspaceRoute>),
  ) =>
    setRoute((old) => ({
      ...old,
      ...(typeof patch === "function" ? patch(old) : patch),
    }));
  return { route, navigate, reset: () => setRoute({ ...emptyRoute }) };
}
// Only uncritical UI preferences; never source roots, consent, secrets or model responses.
export function useProjectDraft<T>(
  projectId: string,
  key: string,
  fallback: T,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `sitefenn:ui:2.2:${projectId}:${key}`;
  const read = (): T => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      if (typeof v !== typeof fallback || v === null) return fallback;
      if (
        typeof fallback === "object" &&
        Object.entries(fallback as object).some(
          ([k, example]) => typeof v[k] !== typeof example,
        )
      )
        return fallback;
      return v as T;
    } catch {
      return fallback;
    }
  };
  const [state, setState] = useState(() => ({
    key: storageKey,
    value: read(),
  }));
  const value = state.key === storageKey ? state.value : read();
  useEffect(() => {
    if (state.key !== storageKey) {
      setState({ key: storageKey, value: read() });
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.value));
    } catch {}
  }, [storageKey, state]);
  const setValue: Dispatch<SetStateAction<T>> = (next) =>
    setState((old) => {
      const previous = old.key === storageKey ? old.value : read();
      return {
        key: storageKey,
        value:
          typeof next === "function" ? (next as (v: T) => T)(previous) : next,
      };
    });
  return [value, setValue] as const;
}
