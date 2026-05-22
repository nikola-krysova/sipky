import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { OpeningHours, ReservationRules, DayKey } from "../../types/reservation";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Pondělí",
  tuesday: "Úterý",
  wednesday: "Středa",
  thursday: "Čtvrtek",
  friday: "Pátek",
  saturday: "Sobota",
  sunday: "Neděle",
};

const DAY_ORDER: DayKey[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export default function AdminSettings() {
  const [openingHours, setOpeningHours] = useState<OpeningHours | null>(null);
  const [rules, setRules] = useState<ReservationRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const [{ data: oh }, { data: rr }] = await Promise.all([
        supabase.from("settings").select("value").eq("key", "opening_hours").single(),
        supabase.from("settings").select("value").eq("key", "reservation_rules").single(),
      ]);
      if (oh) setOpeningHours(oh.value);
      if (rr) setRules(rr.value);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!openingHours || !rules) return;
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from("settings").update({ value: openingHours }).eq("key", "opening_hours"),
      supabase.from("settings").update({ value: rules }).eq("key", "reservation_rules"),
    ]);
    if (r1.error || r2.error) {
      toast.error("Chyba při ukládání nastavení");
    } else {
      toast.success("Nastavení uloženo");
    }
    setSaving(false);
  };

  const updateDay = (day: DayKey, field: "open" | "close" | "closed", value: string | boolean) => {
    if (!openingHours) return;
    setOpeningHours({
      ...openingHours,
      [day]: { ...openingHours[day], [field]: value },
    });
  };

  const updateRule = (key: keyof ReservationRules, value: number) => {
    if (!rules) return;
    setRules({ ...rules, [key]: value });
  };

  const inputClass = "border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-black";

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-6">Nastavení</h1>

      {/* Opening hours */}
      <section className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold mb-4 uppercase tracking-wider text-gray-700">
          Otevírací hodiny
        </h2>
        <div className="space-y-3">
          {DAY_ORDER.map((day) => {
            const h = openingHours![day];
            return (
              <div key={day} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium">{DAY_LABELS[day]}</div>
                <input
                  type="checkbox"
                  checked={!h.closed}
                  onChange={(e) => updateDay(day, "closed", !e.target.checked)}
                  className="accent-black"
                  title="Otevřeno"
                />
                <input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => updateDay(day, "open", e.target.value)}
                  className={`${inputClass} ${h.closed ? "opacity-40" : ""}`}
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="time"
                  value={h.close === "24:00" ? "23:59" : h.close}
                  disabled={h.closed}
                  onChange={(e) => {
                    const v = e.target.value === "23:59" ? "24:00" : e.target.value;
                    updateDay(day, "close", v);
                  }}
                  className={`${inputClass} ${h.closed ? "opacity-40" : ""}`}
                />
                {h.closed && <span className="text-xs text-gray-400">Zavřeno</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Reservation rules */}
      <section className="bg-white border border-gray-100 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold mb-4 uppercase tracking-wider text-gray-700">
          Pravidla rezervace
        </h2>
        <div className="space-y-4">
          {rules && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Minimální délka (min)</label>
                <input
                  type="number"
                  min={30}
                  max={180}
                  step={30}
                  value={rules.min_duration_minutes}
                  onChange={(e) => updateRule("min_duration_minutes", Number(e.target.value))}
                  className={`${inputClass} w-24 text-right`}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Maximální délka (min)</label>
                <input
                  type="number"
                  min={60}
                  max={360}
                  step={30}
                  value={rules.max_duration_minutes}
                  onChange={(e) => updateRule("max_duration_minutes", Number(e.target.value))}
                  className={`${inputClass} w-24 text-right`}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Granularita slotů (min)</label>
                <input
                  type="number"
                  min={15}
                  max={60}
                  step={15}
                  value={rules.slot_granularity_minutes}
                  onChange={(e) => updateRule("slot_granularity_minutes", Number(e.target.value))}
                  className={`${inputClass} w-24 text-right`}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Min. dní dopředu</label>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={rules.min_days_ahead}
                  onChange={(e) => updateRule("min_days_ahead", Number(e.target.value))}
                  className={`${inputClass} w-24 text-right`}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Max. dní dopředu</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={rules.max_days_ahead}
                  onChange={(e) => updateRule("max_days_ahead", Number(e.target.value))}
                  className={`${inputClass} w-24 text-right`}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <Button onClick={handleSave} loading={saving} size="lg">
        Uložit nastavení
      </Button>
    </div>
  );
}
