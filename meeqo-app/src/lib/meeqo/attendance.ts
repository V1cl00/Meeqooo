/**
 * The day before a meetup, guests are asked "are you still coming?". If they do not answer and someone waits for a spot,
 * the spot goes to the waitlist shortly before the start. Without a waitlist nobody is removed: an empty chair hurts no one.
 */
export type ConfirmAction = "none" | "ask" | "release";

export const ASK_WITHIN_HOURS = 24;
export const RELEASE_WITHIN_HOURS = 2.5;
/** How long after the question a guest has before the spot may go. */
export const GRACE_MINUTES = 90;

export function confirmAction(input: { startsAt: string; now: Date; confirmed: boolean; askedAt: string | null; waitlist: number }): ConfirmAction {
  const hours = (new Date(input.startsAt).getTime() - input.now.getTime()) / 3_600_000;
  if (input.confirmed || hours <= 0.25 || hours > ASK_WITHIN_HOURS) return "none";
  if (!input.askedAt) return "ask";
  const waited = (input.now.getTime() - new Date(input.askedAt).getTime()) / 60_000;
  if (input.waitlist > 0 && hours <= RELEASE_WITHIN_HOURS && waited >= GRACE_MINUTES) return "release";
  return "none";
}
