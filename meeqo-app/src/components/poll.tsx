import { useState } from "react";
import { closePoll, createPoll, votePoll } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import type { PollView } from "@/lib/meeqo/types";

const chip = "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold";

/** A vote on the time, inside the chat. The host can set the winner as the new start. */
export function PollCard({ poll, onChanged }: { poll: PollView; onChanged: () => void }) {
  const [fail, setFail] = useState("");
  const top = Math.max(0, ...poll.options.map((option) => option.votes));

  async function vote(index: number) {
    setFail("");
    try {
      await votePoll({ data: { pollId: poll.id, optionIdx: index } });
      onChanged();
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function close(applyIdx?: number) {
    setFail("");
    try {
      await closePoll({ data: { pollId: poll.id, applyIdx } });
      notice(applyIdx == null ? "Abstimmung beendet." : "Neuer Termin gesetzt. Alle bekommen Bescheid.");
      onChanged();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <section className="card space-y-3 p-4" aria-label={poll.question}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Abstimmung von {poll.creatorName}</p>
        <h3 className="font-display text-xl leading-tight">{poll.question}</h3>
      </div>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const mine = poll.mine === index;
          return (
            <div key={option.at} className="flex items-center gap-2">
              <button
                type="button"
                disabled={poll.closed}
                aria-pressed={mine}
                onClick={() => vote(index)}
                className={`${chip} min-w-0 flex-1 justify-between gap-2 ${mine ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}
              >
                <span className="truncate">{formatWhen(option.at)}</span>
                <span className={option.votes > 0 && option.votes === top ? "font-bold" : ""}>{option.votes}</span>
              </button>
              {poll.canClose && !poll.closed ? (
                <button type="button" className={`${chip} shrink-0 border-ink bg-ink text-onaccent`} onClick={() => close(index)}>Festlegen</button>
              ) : null}
            </div>
          );
        })}
      </div>
      {poll.closed ? <p className="text-sm font-semibold text-muted">Beendet</p> : null}
      {poll.canClose && !poll.closed ? <button type="button" className="text-sm font-semibold underline" onClick={() => close()}>Ohne Änderung beenden</button> : null}
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </section>
  );
}

export function PollForm({ activityId, onDone }: { activityId: string; onDone: () => void }) {
  const [times, setTimes] = useState(["", ""]);
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setFail("");
    try {
      const options = times.filter(Boolean).map((value) => new Date(value).toISOString());
      await createPoll({ data: { activityId, options } });
      notice("Abstimmung ist raus.");
      onDone();
    } catch (err) {
      setFail(errText(err));
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-display text-xl">Wann passt es euch?</h3>
      {times.map((value, index) => (
        <input
          key={index}
          type="datetime-local"
          value={value}
          aria-label={`Zeit ${index + 1}`}
          onChange={(event) => setTimes((list) => list.map((item, at) => (at === index ? event.target.value : item)))}
          className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none focus:border-accent"
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {times.length < 4 ? <button type="button" className={`${chip} border-line bg-card text-ink`} onClick={() => setTimes((list) => [...list, ""])}>Weitere Zeit</button> : null}
        <button type="button" disabled={busy} className={`${chip} border-accent bg-accent text-onfill disabled:opacity-50`} onClick={submit}>Abstimmen lassen</button>
        <button type="button" className={`${chip} border-transparent text-muted`} onClick={onDone}>Abbrechen</button>
      </div>
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}
