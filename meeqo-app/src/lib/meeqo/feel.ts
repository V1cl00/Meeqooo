import { toast } from "sonner";

/** A short buzz on phones that support it. Confirms an action without a dialog. */
export function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/** One quiet confirmation at the top, instead of a line somewhere down the page. */
export function notice(message: string) {
  buzz();
  toast(message);
}
