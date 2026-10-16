import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#F7F1EA]">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <Link href="/profile" className="text-sm">← Zurück</Link>
        <h1 className="font-semibold">Einstellungen</h1>
        <div />
      </header>
      <div className="px-4 space-y-3">
        <Link href="/login" className="block bg-white rounded-2xl p-4 text-sm">Abmelden</Link>
      </div>
    </div>
  );
}
