"use client";

import Link from "next/link";
import { useState } from "react";

const activities = [
  {
    id: 1,
    title: "Pastaworkshop bei Giulia",
    category: "Essen",
    intention: "Kein Dating",
    date: "Sa, 24. Mai · 16:00",
    location: "Kreuzberg, Berlin",
    spots: "4 von 8",
  },
  {
    id: 2,
    title: "Bouldern & Kaffee",
    category: "Sport",
    intention: "Date",
    date: "Mi, 28. Mai · 18:30",
    location: "Ostkreuz, Berlin",
    spots: "2 von 6",
  },
  {
    id: 3,
    title: "Calisthenics im Park",
    category: "Sport",
    subcategory: "Calisthenics",
    intention: "Sowohl als auch",
    date: "So, 1. Juni · 10:00",
    location: "Tiergarten, Berlin",
    spots: "5 von 10",
  },
];

export default function Home() {
  const [intention, setIntention] = useState("Alle");

  return (
    <div className="min-h-screen bg-[#F7F1EA] pb-20">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Mee<span className="text-[#E07A5F]">Qo</span>
        </h1>
        <Link href="/notifications" className="text-xl">🔔</Link>
      </header>

      <div className="px-4 space-y-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
          {["Heute", "Morgen", "Wochenende"].map((t) => (
            <button key={t} className="px-4 py-1.5 rounded-full bg-white border text-sm whitespace-nowrap">
              {t}
            </button>
          ))}
          <Link href="/calendar" className="px-4 py-1.5 rounded-full bg-white border text-sm">📅</Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
          {["Alle", "Sport", "Essen", "Spiele", "Outdoor"].map((c) => (
            <button key={c} className="px-3 py-1 rounded-full bg-white border text-xs whitespace-nowrap">
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {["Alle", "Date", "Kein Dating"].map((i) => (
            <button
              key={i}
              onClick={() => setIntention(i)}
              className={`px-3 py-1 rounded-full text-xs ${intention === i ? "bg-[#E07A5F] text-white" : "bg-white border"}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {activities.map((a) => (
          <Link key={a.id} href={`/activity/${a.id}`} className="block bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-[#E07A5F]">{a.category}</span>
                <h3 className="font-semibold mt-1">{a.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{a.date}</p>
                <p className="text-sm text-gray-500">{a.location}</p>
              </div>
              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{a.intention}</span>
            </div>
            <div className="mt-3 bg-[#E07A5F] text-white text-center py-2 rounded-full text-sm">
              Teilnahme anfragen
            </div>
          </Link>
        ))}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 text-xs max-w-md mx-auto">
        <Link href="/" className="flex flex-col items-center text-[#E07A5F]">🏠<span>Feed</span></Link>
        <Link href="/calendar" className="flex flex-col items-center opacity-60">📅<span>Kalender</span></Link>
        <Link href="/create" className="flex flex-col items-center opacity-60">➕<span>Erstellen</span></Link>
        <Link href="/profile" className="flex flex-col items-center opacity-60">👤<span>Profil</span></Link>
      </nav>
    </div>
  );
}
