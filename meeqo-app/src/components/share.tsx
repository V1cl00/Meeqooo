export function ShareSheet({
  open,
  title,
  text,
  onClose,
}: {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
}) {
  if (!open) return null;
  const encoded = encodeURIComponent(text);
  const page = typeof window === "undefined" ? "" : window.location.href;
  const channels = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encoded}`, copy: false },
    { name: "E-Mail", href: `mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`, copy: false },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page)}&quote=${encoded}`, copy: false },
    { name: "Instagram", href: "https://www.instagram.com/", copy: true },
    { name: "TikTok", href: "https://www.tiktok.com/", copy: true },
    { name: "Nebenan.de", href: "https://nebenan.de/", copy: true },
  ];

  async function go(item: (typeof channels)[number]) {
    if (item.copy) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* the site still opens */
      }
    }
    window.open(item.href, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3" onClick={onClose}>
      <div className="card w-full max-w-lg space-y-3 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Teilen</h2>
          <button type="button" className="inline-flex h-11 items-center rounded-full border-2 border-line bg-card px-4 text-sm font-semibold" onClick={onClose}>Schließen</button>
        </div>
        <p className="text-sm text-muted">Instagram, TikTok und Nebenan.de bekommen den Text in die Zwischenablage.</p>
        <div className="grid grid-cols-2 gap-2">
          {channels.map((item) => (
            <button key={item.name} type="button" className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-line bg-card text-sm font-semibold" onClick={() => go(item)}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
