import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import type { OpeningHours, ReservationRules } from "../types/reservation";
import ReservationCalendar from "../components/Calendar/ReservationCalendar";
import ReservationForm from "../components/Reservation/ReservationForm";
import ReservationSuccess from "../components/Reservation/ReservationSuccess";
import { Skeleton } from "../components/ui/Skeleton";

const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday:    { open: "15:00", close: "20:00" },
  tuesday:   { open: "15:00", close: "20:00" },
  wednesday: { open: "15:00", close: "20:00" },
  thursday:  { open: "15:00", close: "20:00" },
  friday:    { open: "15:00", close: "24:00" },
  saturday:  { open: "14:00", close: "22:00" },
  sunday:    { open: "14:00", close: "20:00" },
};

const DEFAULT_RULES: ReservationRules = {
  min_duration_minutes: 60,
  max_duration_minutes: 180,
  slot_granularity_minutes: 30,
  min_days_ahead: 1,
  max_days_ahead: 30,
};

type View = "calendar" | "form" | "success";

export default function HomePage() {
  const [view, setView] = useState<View>("calendar");
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [successToken, setSuccessToken] = useState<string>("");
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [rules, setRules] = useState<ReservationRules>(DEFAULT_RULES);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [{ data: oh, error: ohErr }, { data: rr, error: rrErr }] = await Promise.all([
          supabase.from("settings").select("value").eq("key", "opening_hours").single(),
          supabase.from("settings").select("value").eq("key", "reservation_rules").single(),
        ]);
        if (ohErr || rrErr) {
          console.warn("Nepodařilo se načíst nastavení z DB, používám výchozí hodnoty.", ohErr ?? rrErr);
        }
        if (oh?.value) setOpeningHours(oh.value);
        if (rr?.value) setRules(rr.value);
      } catch (e) {
        console.warn("Chyba při načítání nastavení:", e);
      } finally {
        setLoadingSettings(false);
      }
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-xl font-semibold tracking-tight whitespace-nowrap">
              Restaurace U Školy
            </span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="text-sm text-gray-500 uppercase tracking-widest hidden sm:inline">
              Milešovice
            </span>
          </div>
          <a
            href="tel:+420"
            className="text-xs text-gray-500 hover:text-black transition-colors uppercase tracking-wider hidden md:inline"
          >
            Rezervace jen online
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl font-semibold mb-3">
            Rezervace šipek
          </h1>
          <p className="text-gray-600 text-lg mb-6">
            Zarezervujte si šipkový terč online. Jeden terč, žádné čekání.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-200 border border-green-400" />
              <span className="text-gray-600">Volno – klikněte pro rezervaci</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-300 border border-red-500" />
              <span className="text-gray-600">Obsazeno</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" />
              <span className="text-gray-600">Zavřeno / mimo provoz</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loadingSettings ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
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
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 mt-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-sm">
            <div>
              <p className="font-semibold uppercase tracking-wider text-xs text-gray-400 mb-2">Restaurace</p>
              <p className="text-gray-700 font-medium">U Školy Milešovice</p>
              <p className="text-gray-500">Milešovice, okres Vyškov</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-xs text-gray-400 mb-2">Otevírací doba</p>
              <p className="text-gray-500">Po–Čt: 15:00–20:00</p>
              <p className="text-gray-500">Pá: 15:00–24:00</p>
              <p className="text-gray-500">So: 14:00–22:00 · Ne: 14:00–20:00</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-xs text-gray-400 mb-2">Rezervace</p>
              <p className="text-gray-500">Rezervace terče pouze online.</p>
              <p className="text-gray-500">Min. 1 hodina dopředu.</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Restaurace U Školy Milešovice
          </div>
        </div>
      </footer>
    </div>
  );
}
