import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import type { OpeningHours, ReservationRules } from "../types/reservation";
import ReservationCalendar from "../components/Calendar/ReservationCalendar";
import ReservationForm from "../components/Reservation/ReservationForm";
import ReservationSuccess from "../components/Reservation/ReservationSuccess";
import { Skeleton } from "../components/ui/Skeleton";

type View = "calendar" | "form" | "success";

export default function HomePage() {
  const [view, setView] = useState<View>("calendar");
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [successToken, setSuccessToken] = useState<string>("");
  const [openingHours, setOpeningHours] = useState<OpeningHours | null>(null);
  const [rules, setRules] = useState<ReservationRules | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const [{ data: oh }, { data: rr }] = await Promise.all([
        supabase.from("settings").select("value").eq("key", "opening_hours").single(),
        supabase.from("settings").select("value").eq("key", "reservation_rules").single(),
      ]);
      if (oh && rr) {
        setOpeningHours(oh.value);
        setRules(rr.value);
      }
      setLoadingSettings(false);
    };
    fetchSettings();
  }, []);

  const handleSelectSlot = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    setView("form");
  };

  const handleSuccess = (token: string) => {
    setSuccessToken(token);
    setView("success");
  };

  const handleReset = () => {
    setView("calendar");
    setSelectedSlot(null);
    setSuccessToken("");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="font-display text-xl font-semibold tracking-tight">
              Restaurace U Školy
            </span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-sm text-gray-500 uppercase tracking-widest">
              Milešovice
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl font-semibold mb-3">
            Rezervace šipek
          </h1>
          <p className="text-gray-600 text-lg">
            Zarezervujte si šipkový terč online. Jeden terč, žádné čekání.
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loadingSettings ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : openingHours && rules ? (
          <AnimatePresence mode="wait">
            {view === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-1">Dostupné termíny</h2>
                  <p className="text-sm text-gray-500">
                    Klikněte na volný slot v kalendáři pro rezervaci
                  </p>
                </div>
                <ReservationCalendar
                  openingHours={openingHours}
                  rules={rules}
                  onSelectSlot={handleSelectSlot}
                />
              </motion.div>
            )}
            {view === "form" && selectedSlot && (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-lg mx-auto"
              >
                <ReservationForm
                  openingHours={openingHours}
                  rules={rules}
                  initialDate={selectedSlot.date}
                  initialTimeFrom={selectedSlot.time}
                  onSuccess={handleSuccess}
                  onCancel={() => setView("calendar")}
                />
              </motion.div>
            )}
            {view === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-lg mx-auto"
              >
                <ReservationSuccess cancelToken={successToken} onReset={handleReset} />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <p className="text-center text-gray-500">Nepodařilo se načíst nastavení.</p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Restaurace U Školy Milešovice</p>
        </div>
      </footer>
    </div>
  );
}
