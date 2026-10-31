import { useEffect, useState } from "react";
import type { Scan } from "../shared/types.js";
import type { CursorPage, ScanSummary } from "../shared/workspace.js";
import { api, message } from "./api.js";
export function useScanOptions(projectId: string, initial: Scan[]) {
  const [extra, setExtra] = useState<Scan[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    void api<CursorPage<ScanSummary>>(
      `/api/projects/${projectId}/scans?status=completed&limit=50`,
    )
      .then((r) => {
        if (live) {
          setExtra(r.items);
          setCursor(r.nextCursor);
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [projectId]);
  const more = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const r = await api<CursorPage<ScanSummary>>(
        `/api/projects/${projectId}/scans?status=completed&limit=50&cursor=${encodeURIComponent(cursor)}`,
      );
      setExtra((old) => [...old, ...r.items]);
      setCursor(r.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const scans = [
    ...new Map([...initial, ...extra].map((s) => [s.id, s])).values(),
  ];
  return { scans, cursor, busy, error, more };
}
