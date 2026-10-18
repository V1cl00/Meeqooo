import { useEffect, useState } from "react";
import { getAdAttachment, getAttachment } from "@/lib/meeqo/api";
import { t } from "@/lib/meeqo/i18n";
import type { ChatMessage } from "@/lib/meeqo/types";

function sizeLabel(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** A file in a chat bubble: images show up in place, PDFs open on tap. The content is only fetched when needed. */
export function Attachment({ id, file, mine, ad = false }: { id: string; file: NonNullable<ChatMessage["attachment"]>; mine: boolean; ad?: boolean }) {
  const load = ad ? getAdAttachment : getAttachment;
  const [src, setSrc] = useState("");
  const [fail, setFail] = useState(false);
  const image = file.type.startsWith("image/");

  useEffect(() => {
    if (!image || id.startsWith("tmp-")) return;
    let alive = true;
    load({ data: { id } })
      .then((result) => alive && setSrc(`data:${result.type};base64,${result.data}`))
      .catch(() => alive && setFail(true));
    return () => {
      alive = false;
    };
  }, [id, image, ad]);

  async function open() {
    try {
      const result = await load({ data: { id } });
      const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.type }));
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.download = result.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFail(true);
    }
  }

  if (image) {
    return src ? (
      <img src={src} alt={file.name} className="mt-1 max-h-64 w-full rounded-2xl object-cover" />
    ) : (
      <div className="mt-1 grid h-32 w-48 place-items-center rounded-2xl bg-sand-deep text-xs text-muted">{fail ? t("Bild lädt nicht.") : t("Wird geladen…")}</div>
    );
  }
  return (
    <button type="button" onClick={open} className={`mt-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left ${mine ? "border-onaccent/30" : "border-line"}`}>
      <span aria-hidden className="text-xl">📄</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{file.name}</span>
        <span className="block text-xs opacity-80">{fail ? t("Datei lädt nicht.") : `PDF · ${sizeLabel(file.size)}`}</span>
      </span>
    </button>
  );
}
