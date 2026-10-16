import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-[#F7F1EA]">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="text-sm">← Zurück</Link>
        <h1 className="font-semibold">Benachrichtigungen</h1>
        <div />
      </header>
      <p className="px-4 text-sm text-gray-500 text-center mt-12">Noch keine Benachrichtigungen.</p>
    </div>
  );
}
