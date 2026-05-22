import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { Reservation, OpeningHours, ReservationRules } from "../../types/reservation";
import ReservationTable from "../../components/admin/ReservationTable";
import ReservationModal from "../../components/admin/ReservationModal";
import { ConfirmDialog } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";

export default function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingHours, setOpeningHours] = useState<OpeningHours | null>(null);
  const [rules, setRules] = useState<ReservationRules | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "cancelled">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [editModal, setEditModal] = useState(false);
  const [editReservation, setEditReservation] = useState<Reservation | undefined>();

  const [cancelDialog, setCancelDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [cancelSeriesDialog, setCancelSeriesDialog] = useState(false);
  const [deleteSeriesDialog, setDeleteSeriesDialog] = useState(false);
  const [actionReservation, setActionReservation] = useState<Reservation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const exportCSV = () => {
    const headers = ['Datum', 'Od', 'Do', 'Jméno', 'E-mail', 'Telefon', 'Status', 'Poznámka', 'Vytvořeno'];
    const rows = reservations.map((r) => [
      r.date,
      r.time_from.slice(0, 5),
      r.time_to.slice(0, 5),
      r.name,
      r.email,
      r.phone ?? '',
      r.status === 'active' ? 'Aktivní' : 'Zrušená',
      r.note ?? '',
      r.created_at.slice(0, 10),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rezervace-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchAll = async () => {
    setLoading(true);
    let q = supabase
      .from("reservations")
      .select("*")
      .order("date", { ascending: false })
      .order("time_from", { ascending: false });
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (filterDateFrom) q = q.gte("date", filterDateFrom);
    if (filterDateTo) q = q.lte("date", filterDateTo);
    const { data } = await q;
    setReservations(data ?? []);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const [{ data: oh }, { data: rr }] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "opening_hours").single(),
      supabase.from("settings").select("value").eq("key", "reservation_rules").single(),
    ]);
    if (oh) setOpeningHours(oh.value);
    if (rr) setRules(rr.value);
  };

  useEffect(() => {
    fetchAll();
    fetchSettings();
  }, [filterStatus, filterDateFrom, filterDateTo]);

  const handleCancel = async () => {
    if (!actionReservation) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", actionReservation.id);
    if (error) {
      toast.error("Chyba při rušení rezervace");
    } else {
      toast.success("Rezervace zrušena");
      fetchAll();
    }
    setCancelDialog(false);
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!actionReservation) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", actionReservation.id);
    if (error) {
      toast.error("Chyba při mazání");
    } else {
      toast.success("Rezervace smazána");
      fetchAll();
    }
    setDeleteDialog(false);
    setActionLoading(false);
  };

  const handleCancelSeries = async () => {
    if (!actionReservation?.recurring_group_id) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("recurring_group_id", actionReservation.recurring_group_id);
    if (error) {
      toast.error("Chyba při rušení série");
    } else {
      toast.success("Celá série zrušena");
      fetchAll();
    }
    setCancelSeriesDialog(false);
    setActionLoading(false);
  };

  const handleDeleteSeries = async () => {
    if (!actionReservation?.recurring_group_id) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("recurring_group_id", actionReservation.recurring_group_id);
    if (error) {
      toast.error("Chyba při mazání série");
    } else {
      toast.success("Celá série smazána");
      fetchAll();
    }
    setDeleteSeriesDialog(false);
    setActionLoading(false);
  };

  const inputClass = "border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-black";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Rezervace</h1>
        <div className="flex items-center gap-2">
          {reservations.length > 0 && (
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              Export CSV
            </Button>
          )}
          <Button
            onClick={() => { setEditReservation(undefined); setEditModal(true); }}
            size="sm"
          >
            + Přidat ručně
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 bg-gray-50 p-3 rounded-lg">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className={inputClass}
        >
          <option value="all">Vše</option>
          <option value="active">Aktivní</option>
          <option value="cancelled">Zrušené</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className={inputClass}
          placeholder="Od"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className={inputClass}
          placeholder="Do"
        />
        {(filterStatus !== "all" || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterStatus("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
            className="text-sm text-gray-500 hover:text-black"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        <ReservationTable
          reservations={reservations}
          loading={loading}
          onEdit={(r) => { setEditReservation(r); setEditModal(true); }}
          onCancel={(r) => { setActionReservation(r); setCancelDialog(true); }}
          onDelete={(r) => { setActionReservation(r); setDeleteDialog(true); }}
          onCancelSeries={(r) => { setActionReservation(r); setCancelSeriesDialog(true); }}
          onDeleteSeries={(r) => { setActionReservation(r); setDeleteSeriesDialog(true); }}
        />
      </div>

      {openingHours && rules && (
        <ReservationModal
          open={editModal}
          onClose={() => setEditModal(false)}
          reservation={editReservation}
          openingHours={openingHours}
          rules={rules}
          onSaved={fetchAll}
        />
      )}

      <ConfirmDialog
        open={cancelDialog}
        onClose={() => setCancelDialog(false)}
        onConfirm={handleCancel}
        title="Zrušit rezervaci?"
        message={`Zákazník obdrží e-mail o zrušení.`}
        confirmLabel="Ano, zrušit"
        danger
        loading={actionLoading}
      />

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Smazat rezervaci?"
        message="Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        loading={actionLoading}
      />

      <ConfirmDialog
        open={cancelSeriesDialog}
        onClose={() => setCancelSeriesDialog(false)}
        onConfirm={handleCancelSeries}
        title="Zrušit celou sérii?"
        message="Budou zrušeny všechny rezervace v této sérii. Zákazníci obdrží e-mail o zrušení."
        confirmLabel="Ano, zrušit sérii"
        danger
        loading={actionLoading}
      />

      <ConfirmDialog
        open={deleteSeriesDialog}
        onClose={() => setDeleteSeriesDialog(false)}
        onConfirm={handleDeleteSeries}
        title="Smazat celou sérii?"
        message="Budou smazány všechny rezervace v této sérii. Tato akce je nevratná."
        confirmLabel="Smazat sérii"
        danger
        loading={actionLoading}
      />
    </div>
  );
}
