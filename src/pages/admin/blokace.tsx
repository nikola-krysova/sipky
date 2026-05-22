import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { BlockedSlot } from "../../types/reservation";
import { Button } from "../../components/ui/Button";

export default function AdminBlokace() {
  const [slots, setSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [label, setLabel] = useState("Blokováno");

  const fetchSlots = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blocked_slots")
      .select("*")
      .order("date")
      .order("time_from");
    setSlots(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !timeFrom || !timeTo) {
      toast.error("Vyplňte datum a časy");
      return;
    }
    if (timeTo <= timeFrom) {
      toast.error("Čas do musí být větší než čas od");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("blocked_slots").insert({
      date,
      time_from: timeFrom,
      time_to: timeTo,
      label: label || "Blokováno",
    });
    if (error) {
      toast.error("Chyba při přidávání blokace");
    } else {
      toast.success("Blokace přidána");
      setDate("");
      setTimeFrom("");
      setTimeTo("");
      setLabel("Blokováno");
      fetchSlots();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
    if (error) {
      toast.error("Chyba při mazání");
    } else {
      toast.success("Blokace smazána");
      fetchSlots();
    }
  };

  const inputClass = "w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Blokace termínů</h1>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-5 mb-6">
        <h2 className="font-display text-base font-semibold mb-4">Přidat blokaci</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Datum *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Od *</label>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Do *</label>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Popis</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputClass}
              placeholder="Blokováno"
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Button type="submit" loading={saving} size="sm">
              Přidat blokaci
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>Žádné blokace</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Datum", "Čas od", "Čas do", "Popis", "Akce"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs uppercase tracking-wider text-gray-500 px-3 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-medium">{s.date}</td>
                    <td className="px-3 py-3">{s.time_from.slice(0, 5)}</td>
                    <td className="px-3 py-3">{s.time_to.slice(0, 5)}</td>
                    <td className="px-3 py-3 text-gray-600">{s.label}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
