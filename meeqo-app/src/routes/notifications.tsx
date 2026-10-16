import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Empty } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listNotifications, markNotificationsRead } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/notifications")({ component: Page });

function Page() {
  return (
    <Shell>
      <Inbox />
    </Shell>
  );
}

function Inbox() {
  const { data, loading } = useLoad(() => listNotifications(), []);
  useEffect(() => {
    markNotificationsRead().catch(() => {});
  }, []);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl leading-none">Mitteilungen</h1>
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {data?.map((item) => (
        <a key={item.id} href={item.href} className="card block p-4">
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted">{item.body}</p>
          <p className="mt-1 text-xs text-muted">{formatWhen(item.createdAt)}</p>
        </a>
      ))}
      {data && data.length === 0 ? <Empty title="Noch still" body="Anfragen, Zusagen und Erinnerungen landen hier." /> : null}
    </div>
  );
}
