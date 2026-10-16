import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeeQo",
  description: "Menschen kennenlernen durch echte Erlebnisse",
  manifest: "/manifest.json",
  themeColor: "#E07A5F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MeeQo",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-[#F7F1EA] text-[#3D405B] antialiased">
        <div className="max-w-md mx-auto min-h-screen bg-[#F7F1EA] relative pb-20">
          {children}
        </div>
      </body>
    </html>
  );
}
