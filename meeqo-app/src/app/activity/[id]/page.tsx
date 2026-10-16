"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ActivityDetail() {
  const params = useParams();

  return (
    <div className="min-h-screen bg-[#F7F1EA] pb-8">
      <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-100 relative">
        <Link href="/" className="absolute top-4 left-4 bg-white/80 w-9 h-9 rounded-full flex items-center justify-center">
          ←
        </Link>
      </div>

      <div className="px-4 -mt-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-xs text-[#E07A5F]">Sport · Calisthenics</div>
          <h1 className="text-xl font-semibold mt-1">Calisthenics im Park</h1>
          
          <div className="flex gap-4 text-sm text-gray-500 mt-3">
            <span>📅 So, 1. Juni · 10:00</span>
            <span>📍 Tiergarten</span>
          </div>

          <p className="text-sm mt-4 text-gray-700">
            Gemeinsam trainieren, Technik austauschen und danach einen Kaffee trinken. Alle Level willkommen.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div>
              <div className="font-medium text-sm">Jonas</div>
              <div className="text-xs text-gray-500">Veranstalter</div>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Link href="/request" className="flex-1 bg-[#E07A5F] text-white text-center py-3 rounded-full text-sm font-medium">
              Teilnahme anfragen
            </Link>
            <button className="flex-1 border border-[#E07A5F] text-[#E07A5F] py-3 rounded-full text-sm font-medium">
              Nachricht
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
