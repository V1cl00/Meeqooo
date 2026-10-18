/** People still missing until a meetup with a minimum size happens. Counts the host plus accepted guests. 0 = no minimum or reached. */
export function stillNeeded(minPeople: number, acceptedGuests: number) {
  if (!minPeople || minPeople < 2) return 0;
  return Math.max(0, minPeople - (acceptedGuests + 1));
}
