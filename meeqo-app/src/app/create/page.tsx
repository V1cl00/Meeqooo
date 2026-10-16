"use client";

import Link from "next/link";
import { useState } from "react";

export default function CreatePage() {
  const [intention, setIntention] = useState("Kein Dating");

  return (
    <div className="min-h-screen bg-[#F7F1EA] pb-20">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="text-sm">← Zurück</Link>
        <h1 className="font-semibold">Aktivität erstellen</h1>
        <div />
      </header>

      <div className="px-4 space-y-4">
        <div className="bg-white rounded-2xl p-4">
          <label className="text-sm font-medium">Titel</label>
          <input className="w-full mt-1 p-2 border rounded-lg text-sm" placeholder="z. B. Calisthenics im Park" />
        </div>

        <div className="bg-white rounded-2xl p-4">
          <label className="text-sm font-medium">Beschreibung</label>
          <textarea className="w-full mt-1 p-2 border rounded-lg text-sm h-24" placeholder="Was erwartet die Teilnehmenden?" />
        </div>

        <div className="bg-white rounded-2xl p-4">
          <label className="text-sm font-medium">Kategorie</label>
          <select className="w-full mt-1 p-2 border rounded-lg text-sm">
            <option>Sport</option>
            <option>Essen</option>
            <option>Spiele</option>
            <option>Outdoor</option>
          </select>
          <button className="mt-2 text-sm text-[#E07A5F]">+ Neue Unterkategorie</button>
        </div>

        <div className="bg-white rounded-2xl p-4">
          <label className="text-sm font-medium mb-2 block">Absicht</label>
          <div className="grid grid-cols-3 gap-2">
            {["Date", "Kein Dating", "Sowohl als auch"].map((i) => (
              <button
                key={i}
                onClick={() => setIntention(i)}
                className={`p-2 text-xs rounded-lg border ${intention === i ? "bg-[#E07A5F] text-white" : "bg-white"}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <button className="w-full bg-[#E07A5F] text-white py-3 rounded-full font-medium">
          Veröffentlichen
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 text-xs max-w-md mx-auto">
        <Link href="/" className="flex flex-col items-center opacity-60">🏠<span>Feed</span></Link>
        <Link href="/calendar" className="flex flex-col items-center opacity-60">📅<span>Kalender</span></Link>
        <Link href="/create" className="flex flex-col items-center text-[#E07A5F]">➕<span>Erstellen</span></Link>
        <Link href="/profile" className="flex flex-col items-center opacity-60">👤<span>Profil</span></Link>
      </nav>
    </div>
  );
}
