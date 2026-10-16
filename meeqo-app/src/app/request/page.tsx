"use client";

import Link from "next/link";

export default function RequestPage() {
  return (
    <div className="min-h-screen bg-[#F7F1EA]">
      <header className="px-4 pt-6 pb-4">
        <Link href="/" className="text-sm text-[#E07A5F]">← Zurück</Link>
      </header>

      <div className="px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center text-2xl">👤</div>
        <h1 className="text-xl font-semibold">Anfrage senden</h1>
        <p className="text-sm text-gray-500 mt-2">Schreibe eine kurze Nachricht an den Veranstalter.</p>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl p-4">
          <textarea
            className="w-full h-32 text-sm outline-none resize-none"
            placeholder="Hallo, ich würde gerne mitmachen..."
          />
        </div>

        <button className="mt-6 w-full bg-[#E07A5F] text-white py-3 rounded-full font-medium">
          Anfrage senden
        </button>
      </div>
    </div>
  );
}
