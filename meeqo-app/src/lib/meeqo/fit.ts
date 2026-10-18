/** How well a meetup fits the person, from things they can see on the card. Plain numbers, so the order can be explained. */
export type FitInput = {
  friendsGoing: number;
  matchesInterest: boolean;
  km: number | null;
  hoursAway: number;
  hostVerified: boolean;
  spotsLeft: number;
};

export type Fit = { score: number; reason: string };

export function fitOf(item: FitInput): Fit {
  const parts: { points: number; label: string }[] = [];
  if (item.friendsGoing > 0) parts.push({ points: Math.min(7, 3 + item.friendsGoing), label: "Freunde dabei" });
  if (item.matchesInterest) parts.push({ points: 3, label: "Passt zu deinen Interessen" });
  if (item.km != null) {
    if (item.km <= 3) parts.push({ points: 3, label: `Nah dran (${Math.max(1, Math.round(item.km))} km)` });
    else if (item.km <= 10) parts.push({ points: 2, label: `${Math.round(item.km)} km entfernt` });
    else if (item.km <= 25) parts.push({ points: 1, label: "" });
  }
  if (item.hoursAway >= 0 && item.hoursAway <= 48) parts.push({ points: 2, label: "Bald" });
  else if (item.hoursAway > 48 && item.hoursAway <= 24 * 7) parts.push({ points: 1, label: "" });
  if (item.hostVerified) parts.push({ points: 1, label: "" });
  parts.push({ points: item.spotsLeft > 0 ? 1 : -3, label: "" });
  const score = parts.reduce((sum, part) => sum + part.points, 0);
  const reason = parts
    .filter((part) => part.label && part.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((part) => part.label)
    .join(" · ");
  return { score, reason };
}
