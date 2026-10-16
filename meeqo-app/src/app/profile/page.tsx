"use client";

import Link from "next/link";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#F7F1EA] pb-20">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-semibold">Profil</h1>
        <Link href="/settings" className="text-sm">Einstellungen</Link>
      </header>

      <div className="px-4 text-center">
        <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Lina</h2>
        <p className="text-sm text-gray-500">Berlin</p>

        <div className="mt-4 bg-white rounded-2xl p-4 text-left">
          <div className="text-sm font-medium mb-2">Deine Absicht</div>
          <div className="text-sm">Sowohl als auch</div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 text-left">
          <div className="text-sm font-medium mb-2">Interessen</div>
          <div className="flex flex-wrap gap-2">
            {["Calisthenics", "Kochen", "Bouldern", "Wandern"].map((i) => (
              <span key={i} className="text-xs bg-gray-100 px-3 py-1 rounded-full">{i}</span>
            ))}
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 text-xs max-w-md mx-auto">
        <Link href="/" className="flex flex-col items-center opacity-60">🏠<span>Feed</span></Link>
        <Link href="/calendar" className="flex flex-col items-center opacity-60">📅<span>Kalender</span></Link>
        <Link href="/create" className="flex flex-col items-center opacity-60">➕<span>Erstellen</span></Link>
        <Link href="/profile" className="flex flex-col items-center text-[#E07A5F]">👤<span>Profil</span></Link>
      </nav>
    </div>
  );
}
