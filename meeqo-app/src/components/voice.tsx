import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { locale, t } from "@/lib/meeqo/i18n";

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null };

function recognizer(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speak the meetup in one sentence. Uses the browser's speech recognition where it exists;
 * otherwise the button explains how to use the keyboard's dictation instead. No audio is sent to MeeQo.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<Recognition | null>(null);

  function start() {
    setNote("");
    const Ctor = recognizer();
    if (!Ctor) {
      setNote(t("Dein Browser kann das nicht. Tipp ins Feld und nutz das Mikrofon deiner Tastatur."));
      return;
    }
    const r = new Ctor();
    r.lang = locale();
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (text) onText(text);
    };
    r.onerror = (event) => setNote(event.error === "not-allowed" ? t("Mikrofon nicht freigegeben.") : t("Nicht verstanden. Nochmal?"));
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={() => (listening ? rec.current?.stop() : start())} aria-pressed={listening} className={`inline-flex h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold ${listening ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}>
        {listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        {listening ? t("Hört zu… tippen zum Stoppen") : t("Einsprechen")}
      </button>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  );
}
