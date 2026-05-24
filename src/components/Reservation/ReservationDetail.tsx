import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { EDGE_FUNCTION_URL } from "../../lib/supabase";
import { supabase } from "../../lib/supabase";
import type { Reservation, OpeningHours, ReservationRules } from "../../types/reservation";
import { formatDate, formatTime } from "../../lib/validations";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import ReservationCalendar from "../Calendar/ReservationCalendar";
import ReservationForm from "./ReservationForm";

export default function ReservationDetail() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showChangeCalendar, setShowChangeCalendar] = useState(false);
  const [changeSlot, setChangeSlot] = useState<{ date: string; time: string } | null>(null);
  const [settings, setSettings] = useState<{ openingHours: OpeningHours; rules: ReservationRules } | null>(null);
  const changed = (location.state as { changed?: boolean } | null)?.changed ?? false;

  const fetchReservation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${EDGE_FUNCTION_URL}/get-reservation?token=${token}`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setReservation(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const { data: ohRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "opening_hours")
      .single();
    const { data: rrRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "reservation_rules")
      .single();
    if (ohRow && rrRow) {
      setSettings({ openingHours: ohRow.value, rules: rrRow.value });
    }
  };

  useEffect(() => {
    fetchReservation();
    fetchSettings();
  }, [token]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${EDGE_FUNCTION_URL}/cancel-reservation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Chyba při rušení rezervace");
        return;
      }
      setReservation((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      toast.success("Rezervace byla zrušena");
    } catch {
      toast.error("Síťová chyba");
    } finally {
      setCancelling(false);
      setCancelDialog(false);
    }
  };

  const handleChangeSuccess = (newToken: string) => {
    navigate(`/rezervace/${newToken}`, { state: { changed: true } });
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound || !reservation) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <h2 className="font-display text-2xl font-semibold mb-2">Rezervace nenalezena</h2>
        <p className="text-gray-600 mb-6">Odkaz je neplatný nebo rezervace neexistuje.</p>
        <Link to="/"><Button>Zpět na hlavní stránku</Button></Link>
      </div>
    );
  }

  if (reservation.status === "cancelled") {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">Rezervace byla zrušena</h2>
        <p className="text-gray-600 mb-6">
          {reservation.date && `Termín ${formatDate(reservation.date)} ${formatTime(reservation.time_from)}–${formatTime(reservation.time_to)} je nyní volný.`}
        </p>
        <Link to="/"><Button>Zarezervovat nový termín</Button></Link>
      </div>
    );
  }

  if (showChangeCalendar && settings) {
    if (changeSlot) {
      return (
        <div className="max-w-lg mx-auto p-6">
          <ReservationForm
            openingHours={settings.openingHours}
            rules={settings.rules}
            initialDate={changeSlot.date}
            initialTimeFrom={changeSlot.time}
            prefillData={{ name: reservation.name, email: reservation.email, phone: reservation.phone }}
            cancelToken={reservation.cancel_token}
            onSuccess={handleChangeSuccess}
            onCancel={() => setChangeSlot(null)}
          />
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowChangeCalendar(false)} className="text-gray-500 hover:text-black">
            ← Zpět
          </button>
          <h2 className="font-display text-xl font-semibold">Vyberte nový termín</h2>
        </div>
        <ReservationCalendar
          openingHours={settings.openingHours}
          rules={settings.rules}
          onSelectSlot={(date, time) => setChangeSlot({ date, time })}
          excludeReservationId={reservation.id}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto p-6"
    >
      {changed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-green-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Termín byl úspěšně změněn
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
        <h2 className="font-display text-2xl font-semibold mb-6">Vaše rezervace</h2>

        <div className="space-y-3 mb-6">
          {reservation.reservation_number && (
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Číslo rezervace</span>
              <span className="text-sm font-mono font-semibold">
                #{String(reservation.reservation_number).padStart(4, "0")}
              </span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Jméno</span>
            <span className="text-sm font-medium">{reservation.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Datum</span>
            <span className="text-sm font-medium">{formatDate(reservation.date)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Čas</span>
            <span className="text-sm font-medium">
              {formatTime(reservation.time_from)} – {formatTime(reservation.time_to)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Místo</span>
            <span className="text-sm font-medium">Restaurace U Školy, Milešovice</span>
          </div>
          {reservation.note && (
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Poznámka</span>
              <span className="text-sm font-medium">{reservation.note}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">Status</span>
            <span className="text-sm font-medium text-green-600">Aktivní</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowChangeCalendar(true)}
          >
            Změnit termín
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setCancelDialog(true)}
          >
            Zrušit rezervaci
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={cancelDialog}
        onClose={() => setCancelDialog(false)}
        onConfirm={handleCancel}
        title="Zrušit rezervaci?"
        message={`Opravdu chcete zrušit rezervaci na ${formatDate(reservation.date)} v ${formatTime(reservation.time_from)}–${formatTime(reservation.time_to)}?`}
        confirmLabel="Ano, zrušit"
        danger
        loading={cancelling}
      />
    </motion.div>
  );
}
