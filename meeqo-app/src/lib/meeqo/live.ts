/**
 * In-process "something changed in this chat" signal. On one server it wakes waiting requests at once;
 * across several servers the waiting request falls back to checking the database every few seconds.
 */
const target: EventTarget = ((globalThis as { __meeqoLive?: EventTarget }).__meeqoLive ??= new EventTarget());

export function bump(threadId: string) {
  target.dispatchEvent(new Event(threadId));
}

/** Resolves when the thread is bumped or after `ms`, whichever comes first. */
export function waitBump(threadId: string, ms: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener(threadId, done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    target.addEventListener(threadId, done, { once: true });
  });
}
