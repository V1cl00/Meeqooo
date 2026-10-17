import { toast } from "sonner";
import { tap } from "@/lib/meeqo/native";

/** A short buzz on phones that support it. Confirms an action without a dialog. */
export function buzz(ms = 12) {
  void tap(ms).then((done) => {
    if (done) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  });
}

/** One quiet confirmation at the top, instead of a line somewhere down the page. */
export function notice(message: string) {
  buzz();
  toast(message);
}
