import type { Reservation } from "../../types/reservation";
import { formatDate, formatTime } from "../../lib/validations";

interface Props {
  reservations: Reservation[];
  onEdit: (r: Reservation) => void;
  onCancel: (r: Reservation) => void;
  onDelete: (r: Reservation) => void;
  onCancelSeries?: (r: Reservation) => void;
  onDeleteSeries?: (r: Reservation) => void;
  loading?: boolean;
}

export default function ReservationTable({
  reservations,
  onEdit,
  onCancel,
  onDelete,
  onCancelSeries,
  onDeleteSeries,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Žádné rezervace</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["Datum", "Čas", "Jméno", "E-mail", "Telefon", "Status", "Poznámka", "Akce"].map(
              (h) => (
                <th
                  key={h}
                  className="text-left text-xs uppercase tracking-wider text-gray-500 px-3 py-3"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr
              key={r.id}
              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-3 font-medium">{formatDate(r.date)}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                {formatTime(r.time_from)} – {formatTime(r.time_to)}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5">
                  {r.recurring_group_id && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">↻</span>
                  )}
                  {r.name}
                </div>
              </td>
              <td className="px-3 py-3 text-gray-600">{r.email}</td>
              <td className="px-3 py-3 text-gray-600">{r.phone || "–"}</td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "active"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {r.status === "active" ? "Aktivní" : "Zrušena"}
                </span>
              </td>
              <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">
                {r.note || "–"}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(r)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Upravit
                  </button>
                  {r.status === "active" && (
                    <button
                      onClick={() => onCancel(r)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Zrušit
                    </button>
                  )}
                  {r.status === "active" && r.recurring_group_id && onCancelSeries && (
                    <button
                      onClick={() => onCancelSeries(r)}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      Série
                    </button>
                  )}
                  {r.status === "cancelled" && (
                    <button
                      onClick={() => onDelete(r)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Smazat
                    </button>
                  )}
                  {r.status === "cancelled" && r.recurring_group_id && onDeleteSeries && (
                    <button
                      onClick={() => onDeleteSeries(r)}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Smazat sérii
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
