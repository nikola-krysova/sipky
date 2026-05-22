import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, addHours } from "date-fns";
import { supabase } from "../../lib/supabase";
import type { Reservation } from "../../types/reservation";
import { formatTime } from "../../lib/validations";
import StatsCards from "../../components/admin/StatsCards";
import { Skeleton } from "../../components/ui/Skeleton";

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const now = new Date();
  const twoHoursLater = addHours(now, 2);

  const fetchReservations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("status", "active")
      .order("date", { ascending: true })
      .order("time_from", { ascending: true });
    setReservations(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchReservations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const todayReservations = reservations.filter((r) => r.date === today);
  const weekReservations = reservations.filter((r) => r.date >= weekStart && r.date <= weekEnd);
  const upcoming = todayReservations.filter((r) => {
    const [h, m] = r.time_from.split(":").map(Number);
    const t = new Date();
    t.setHours(h, m, 0, 0);
    return t >= now && t <= twoHoursLater;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <Link to="/admin/rezervace" className="text-sm text-gray-500 hover:text-black transition-colors">
          Všechny rezervace →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          <StatsCards
            today={todayReservations.length}
            week={weekReservations.length}
            total={reservations.length}
          />

          {upcoming.length > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">
                ⚠️ Rezervace začínající do 2 hodin:
              </p>
              <ul className="space-y-1">
                {upcoming.map((r) => (
                  <li key={r.id} className="text-sm text-amber-700">
                    {formatTime(r.time_from)} – {formatTime(r.time_to)} · {r.name}
                    {r.phone && ` · ${r.phone}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-base font-semibold mb-3">
              Dnešní rezervace ({format(new Date(), "d. M. yyyy")})
            </h2>
            {todayReservations.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center border border-dashed border-gray-200 rounded-lg">
                Dnes žádné rezervace
              </p>
            ) : (
              <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Čas", "Jméno", "Telefon", "Poznámka"].map((h) => (
                        <th key={h} className="text-left text-xs uppercase tracking-wider text-gray-500 px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayReservations.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {formatTime(r.time_from)} – {formatTime(r.time_to)}
                        </td>
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.phone || "–"}</td>
                        <td className="px-4 py-3 text-gray-500">{r.note || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
