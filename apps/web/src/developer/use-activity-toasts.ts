import { useEffect, useRef } from "react";
import type { RehearsalState } from "@26/shared";
import { toast } from "sonner";
import { activityToasterId } from "../ui/activity-notices";

type Event = RehearsalState["events"][number];
export function activityNotices(events: readonly Event[]) {
  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const key = `${event.kind}:${event.status}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const last = group[group.length - 1]!;
    return {
      key,
      error: last.status === "refused",
      title:
        group.length === 1
          ? `${last.actor} · ${last.detail}`
          : last.status === "refused"
            ? `${group.length} ${last.kind} actions refused`
            : last.kind === "answer" && last.status === "accepted"
              ? `${group.length} answers accepted`
              : `${group.length} ${last.kind} updates`,
      description: group.length > 1 ? `${last.actor} · ${last.detail}` : undefined,
    };
  });
}

/** Seed existing history, batch new server receipts, and discard pending work on exit. */
export function useActivityToasts(
  events: readonly Event[] | undefined,
  enabled: boolean,
) {
  const cursor = useRef<number | null>(null);
  const pending = useRef<Event[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ids = useRef(new Set<string>());
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      for (const id of ids.current) toast.dismiss(id);
    },
    [],
  );
  useEffect(() => {
    if (!events) return;
    const latest = Math.max(0, ...events.map((event) => event.id));
    if (cursor.current === null || latest < cursor.current) {
      cursor.current = latest;
      pending.current = [];
      clearTimeout(timer.current);
      timer.current = undefined;
      return;
    }
    const fresh = events.filter((event) => event.id > cursor.current!);
    cursor.current = latest;
    if (!enabled) {
      pending.current = [];
      clearTimeout(timer.current);
      timer.current = undefined;
      return;
    }
    pending.current.push(...fresh);
    if (!pending.current.length || timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      for (const notice of activityNotices(pending.current)
        .sort((a, b) => Number(a.error) - Number(b.error))
        .slice(-3)) {
        const id = `rehearsal-${notice.key}`;
        ids.current.add(id);
        (notice.error ? toast.error : toast)(notice.title, {
          id,
          toasterId: activityToasterId,
          description: notice.description,
        });
      }
      pending.current = [];
    }, 900);
  }, [events, enabled]);
}
