import { useEffect, useRef, useState } from "react";
import { getLang } from "@/lib/meeqo/i18n";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function ctor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speech to text with the browser's own recogniser. `onText` gets each finished phrase.
 * Where the browser has none (Firefox), `supported` is false and the button stays away.
 */
export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState("");
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => {
    setSupported(ctor() !== null);
    return () => rec.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Recognition = ctor();
    if (!Recognition) return;
    setProblem("");
    const next = new Recognition();
    next.lang = getLang() === "en" ? "en-GB" : "de-DE";
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event) => {
      let text = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) text += event.results[index][0].transcript;
      }
      if (text.trim()) callback.current(text.trim());
    };
    next.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setProblem("Das Mikrofon ist nicht freigegeben.");
      else if (event.error !== "no-speech" && event.error !== "aborted") setProblem("Das hat nicht geklappt. Versuch es nochmal.");
    };
    next.onend = () => setListening(false);
    rec.current = next;
    setListening(true);
    try {
      next.start();
    } catch {
      setListening(false);
    }
  }

  return { supported, listening, problem, toggle };
}
