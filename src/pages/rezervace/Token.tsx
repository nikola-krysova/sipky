import ReservationDetail from "../../components/Reservation/ReservationDetail";

export default function ReservacePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <a href="/" className="font-display text-xl font-semibold tracking-tight">
            Restaurace U Školy
          </a>
          <span className="text-gray-400 mx-2">·</span>
          <span className="text-sm text-gray-500 uppercase tracking-widest">Milešovice</span>
        </div>
      </header>
      <main className="py-8">
        <ReservationDetail />
      </main>
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Restaurace U Školy Milešovice</p>
        </div>
      </footer>
    </div>
  );
}
