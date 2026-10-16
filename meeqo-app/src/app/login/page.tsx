"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: simply redirect to feed
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F7F1EA] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold">
            Mee<span className="text-[#E07A5F]">Qo</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-3 border rounded-xl text-sm"
              placeholder="deine@email.de"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 p-3 border rounded-xl text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#E07A5F] text-white py-3 rounded-full font-medium mt-2"
          >
            {mode === "login" ? "Anmelden" : "Registrieren"}
          </button>
        </form>

        <div className="text-center mt-6 text-sm">
          {mode === "login" ? (
            <button onClick={() => setMode("register")} className="text-[#E07A5F]">
              Noch kein Konto? Registrieren
            </button>
          ) : (
            <button onClick={() => setMode("login")} className="text-[#E07A5F]">
              Schon ein Konto? Anmelden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
