import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Empty, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listChats } from "@/lib/meeqo/api";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/chat")({ component: Page });

function Page() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path !== "/chat") return <Outlet />;
  return (
    <Shell>
      <Chats />
    </Shell>
  );
}

function Chats() {
  const { data, loading } = useLoad(() => listChats(), []);
  const [q, setQ] = useState("");
  const threads = (data ?? []).filter((thread) => `${thread.title} ${thread.peerName}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl leading-none">Chat</h1>
      <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Chats durchsuchen" className="rounded-full bg-card" />
      {threads.length ? (
        <div>
          <h2 className="text-base font-semibold">Neu dabei</h2>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {threads.slice(0, 12).map((thread) => (
              <Link key={thread.activityId} to="/chat/$id" params={{ id: thread.activityId }} className="w-[4.5rem] shrink-0 text-center">
                {thread.peerAvatar ? (
                  <img src={thread.peerAvatar} alt="" className="mx-auto h-[4.5rem] w-[4.5rem] rounded-[1.2rem] object-cover shadow-sm" />
                ) : (
                  <span className="mx-auto grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.2rem] bg-card font-display text-xl shadow-sm">{thread.peerName.slice(0, 1)}</span>
                )}
                <span className="mt-1.5 block truncate text-xs font-bold">{thread.peerName.split(",")[0]?.split(" ")[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <section className="card overflow-hidden rounded-[1.6rem] px-4">
        <h2 className="pt-4 text-base font-semibold">Nachrichten</h2>
        {threads.map((thread) => (
          <Link key={`${thread.activityId}-row`} to="/chat/$id" params={{ id: thread.activityId }} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            {thread.peerAvatar ? (
              <img src={thread.peerAvatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sand-deep text-lg font-semibold">{thread.peerName.slice(0, 1)}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold">{thread.peerName.split(",")[0]}</span>
              <span className="block truncate text-sm text-muted">{thread.lastBody}</span>
            </span>
            {thread.group ? <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-wide text-onaccent">GRUPPE</span> : null}
          </Link>
        ))}
      </section>
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {data && threads.length === 0 ? <Empty title="Noch kein Chat" body="Frag eine Aktivität an. Der Chat öffnet sich erst nach der Zusage." /> : null}
    </div>
  );
}