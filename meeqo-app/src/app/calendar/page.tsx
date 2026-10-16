"use client";

import Link from "next/link";

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-[#F7F1EA] pb-20">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="text-sm">← Zurück</Link>
        <h1 className="font-semibold">Kalender</h1>
        <div />
      </header>

      <div className="px-4">
        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <button>←</button>
            <span className="font-medium">Mai 2025</span>
            <button>→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div key={d} className="text-xs text-gray-400 py-1">{d}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <div key={day} className="py-2 relative">
                {day}
                {[5, 12, 18, 24].includes(day) && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#E07A5F] rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Punkte zeigen Tage mit Aktivitäten (abhängig von deinen Filtern).
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 text-xs max-w-md mx-auto">
        <Link href="/" className="flex flex-col items-center opacity-60">🏠<span>Feed</span></Link>
        <Link href="/calendar" className="flex flex-col items-center text-[#E07A5F]">📅<span>Kalender</span></Link>
        <Link href="/create" className="flex flex-col items-center opacity-60">➕<span>Erstellen</span></Link>
        <Link href="/profile" className="flex flex-col items-center opacity-60">👤<span>Profil</span></Link>
      </nav>
    </div>
  );
}
