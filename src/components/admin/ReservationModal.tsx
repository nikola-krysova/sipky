import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { Reservation, OpeningHours, ReservationRules } from "../../types/reservation";
import {
  getOpeningHoursForDate,
  generateTimeSlots,
  generateEndTimeSlots,
} from "../../lib/validations";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

const editSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  date: z.string().min(1),
  time_from: z.string().min(1),
  time_to: z.string().min(1),
  note: z.string().max(300).optional(),
});

type EditSchema = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  reservation?: Reservation;
  openingHours: OpeningHours;
  rules: ReservationRules;
  onSaved: () => void;
}

export default function ReservationModal({
  open,
  onClose,
  reservation,
  openingHours,
  rules,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [startSlots, setStartSlots] = useState<string[]>([]);
  const [endSlots, setEndSlots] = useState<string[]>([]);
  const isNew = !reservation;

  const { register, handleSubmit, watch, reset, formState: { errors } } =
    useForm<EditSchema>({
      resolver: zodResolver(editSchema),
      defaultValues: {
        name: "",
        email: "",
        phone: "",
        date: "",
        time_from: "",
        time_to: "",
        note: "",
      },
    });

  useEffect(() => {
    if (reservation) {
      reset({
        name: reservation.name,
        email: reservation.email,
        phone: reservation.phone ?? "",
        date: reservation.date,
        time_from: reservation.time_from.slice(0, 5),
        time_to: reservation.time_to.slice(0, 5),
        note: reservation.note ?? "",
      });
    } else {
      reset({ name: "", email: "", phone: "", date: "", time_from: "", time_to: "", note: "" });
    }
  }, [reservation, open]);

  const watchDate = watch("date");
  const watchTimeFrom = watch("time_from");

  useEffect(() => {
    if (!watchDate) return;
    try {
      const dayHours = getOpeningHoursForDate(watchDate, openingHours);
      if (!dayHours.closed) {
        setStartSlots(generateTimeSlots(dayHours.open, dayHours.close, rules.slot_granularity_minutes));
      }
    } catch {}
  }, [watchDate, openingHours, rules]);

  useEffect(() => {
    if (!watchDate || !watchTimeFrom) return;
    try {
      const dayHours = getOpeningHoursForDate(watchDate, openingHours);
      if (!dayHours.closed) {
        setEndSlots(generateEndTimeSlots(watchTimeFrom, dayHours.close, rules.min_duration_minutes, rules.max_duration_minutes));
      }
    } catch {}
  }, [watchTimeFrom, watchDate, openingHours, rules]);

  const onSubmit = async (data: EditSchema) => {
    setLoading(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("reservations").insert({
          ...data,
          phone: data.phone || null,
          note: data.note || null,
          status: "active",
        });
        if (error) throw error;
        toast.success("Rezervace přidána");
      } else {
        const { error } = await supabase
          .from("reservations")
          .update({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            date: data.date,
            time_from: data.time_from,
            time_to: data.time_to,
            note: data.note || null,
          })
          .eq("id", reservation!.id);
        if (error) throw error;
        toast.success("Rezervace uložena");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wider";

  return (
    <Modal open={open} onClose={onClose} title={isNew ? "Přidat rezervaci" : "Upravit rezervaci"} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Jméno *</label>
            <input {...register("name")} className={inputClass} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Telefon</label>
            <input {...register("phone")} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>E-mail *</label>
          <input {...register("email")} type="email" className={inputClass} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Datum *</label>
          <input {...register("date")} type="date" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Čas od *</label>
            {startSlots.length > 0 ? (
              <select {...register("time_from")} className={inputClass}>
                {startSlots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input {...register("time_from")} type="time" step={1800} className={inputClass} />
            )}
          </div>
          <div>
            <label className={labelClass}>Čas do *</label>
            {endSlots.length > 0 ? (
              <select {...register("time_to")} className={inputClass}>
                {endSlots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input {...register("time_to")} type="time" step={1800} className={inputClass} />
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}>Poznámka</label>
          <textarea {...register("note")} className={`${inputClass} resize-none`} rows={3} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">
            Zrušit
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isNew ? "Přidat" : "Uložit"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
