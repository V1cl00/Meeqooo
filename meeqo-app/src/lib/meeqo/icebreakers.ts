/** Small first questions for the chat, picked by category. Tapping one fills the message box; nothing is sent for you. */
const BY_PARENT: Record<string, string[]> = {
  Sport: ["Was machst du sonst so für Sport?", "Wie lange machst du das schon?", "Soll ich etwas mitbringen?"],
  Essen: ["Gibt es etwas, das du nicht isst?", "Was ist dein Lieblingsessen?", "Kennst du den Ort schon?"],
  Outdoor: ["Was ist dein Lieblingsplatz draußen?", "Soll ich Wasser oder etwas zu essen mitbringen?", "Wie läufst du lieber, flott oder gemütlich?"],
  Kultur: ["Was hast du zuletzt gesehen, das dir geblieben ist?", "Kennst du schon etwas von dort?", "Wollen wir danach noch etwas trinken?"],
  Spiele: ["Welches Spiel magst du am liebsten?", "Kennst du die Regeln schon oder soll ich sie erklären?", "Bringst du ein Spiel mit?"],
  Wellness: ["Warst du schon mal dort?", "Wie lange bleibst du gern?", "Brauche ich etwas Besonderes dabei?"],
  Musik: ["Welche Musik hörst du gerade am meisten?", "Spielst du selbst etwas?", "Was war dein bestes Konzert?"],
  Kreativ: ["Was machst du gern, wenn du Zeit hast?", "Bringst du etwas Eigenes mit?", "Was möchtest du ausprobieren?"],
  Lernen: ["Woran arbeitest du gerade?", "Was möchtest du an dem Tag schaffen?", "Soll ich etwas vorbereiten?"],
  Tiere: ["Wie heißt dein Hund?", "Mag er andere Hunde?", "Welche Runde läufst du am liebsten?"],
  Business: ["Woran arbeitest du gerade?", "Was wünschst du dir von dem Abend?", "Wen suchst du, wen kann ich dir vorstellen?"],
};

const DEFAULT = ["Was hat dich an dem Treffen gereizt?", "Freust du dich schon?", "Kennst du den Ort?"];

const DATE_EXTRA = "Woran erkenne ich dich vor Ort?";

export function icebreakersFor(category: string, intent: string, people: number) {
  const parent = category.split(" · ")[0];
  const base = BY_PARENT[parent] ?? DEFAULT;
  const list = [...base];
  if (intent === "date" && people <= 2) list.push(DATE_EXTRA);
  else if (people > 3) list.unshift("Hallo zusammen, wer ist zum ersten Mal dabei?");
  return list.slice(0, 4);
}
