import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EDGE_FUNCTION_URL } from "../../lib/supabase";
import {
  reservationSchema,
  type ReservationSchema,
  getOpeningHoursForDate,
  generateTimeSlots,
  generateEndTimeSlots,
  validateReservationDates,
  validateTimeRange,
} from "../../lib/validations";
import type { OpeningHours, ReservationRules } from "../../types/reservation";
import { Button } from "../ui/Button";

interface Props {
  openingHours: OpeningHours;
  rules: ReservationRules;
  initialDate?: string;
  initialTimeFrom?: string;
  prefillData?: { name?: string; email?: string; phone?: string };
  cancelToken?: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

export default function ReservationForm({
  openingHours,
  rules,
  initialDate,
  initialTimeFrom,
  prefillData,
  cancelToken,
  onSuccess,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [startSlots, setStartSlots] = useState<string[]>([]);
  const [endSlots, setEndSlots] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReservationSchema>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      name: prefillData?.name ?? "",
      email: prefillData?.email ?? "",
      phone: prefillData?.phone ?? "",
      date: initialDate ?? "",
      time_from: initialTimeFrom ?? "",
      time_to: "",
      note: "",
    },
  });

  const watchDate = watch("date");
  const watchTimeFrom = watch("time_from");

  useEffect(() => {
    if (!watchDate) return;
    const dayHours = getOpeningHoursForDate(watchDate, openingHours);
    if (dayHours.closed) {
      setStartSlots([]);
      return;
    }
    const slots = generateTimeSlots(
      dayHours.open,
      dayHours.close,
      rules.slot_granularity_minutes
    );
    setStartSlots(slots);
    if (!slots.includes(watchTimeFrom)) {
      setValue("time_from", slots[0] ?? "");
    }
  }, [watchDate, openingHours, rules]);

  useEffect(() => {
    if (!watchDate || !watchTimeFrom) return;
    const dayHours = getOpeningHoursForDate(watchDate, openingHours);
    if (dayHours.closed) return;
    const slots = generateEndTimeSlots(
      watchTimeFrom,
      dayHours.close,
      rules.min_duration_minutes,
      rules.max_duration_minutes
    );
    setEndSlots(slots);
    setValue("time_to", slots[0] ?? "");
  }, [watchTimeFrom, watchDate, openingHours, rules]);

  const onSubmit = async (data: ReservationSchema) => {
    const dateError = validateReservationDates(data.date, rules);
    if (dateError) {
      toast.error(dateError);
      return;
    }
    const dayHours = getOpeningHoursForDate(data.date, openingHours);
    const timeError = validateTimeRange(
      data.time_from,
      data.time_to,
      dayHours.open,
      dayHours.close,
      rules
    );
    if (timeError) {
      toast.error(timeError);
      return;
    }

    setLoading(true);
    try {
      const endpoint = cancelToken ? "update-reservation" : "create-reservation";
      const payload = cancelToken
        ? {
            token: cancelToken,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            date: data.date,
            time_from: data.time_from,
            time_to: data.time_to,
            note: data.note || null,
          }
        : {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            date: data.date,
            time_from: data.time_from,
            time_to: data.time_to,
            note: data.note || null,
          };

      const res = await fetch(`${EDGE_FUNCTION_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? (cancelToken ? "Chyba při změně termínu" : "Chyba při vytváření rezervace"));
        return;
      }
      onSuccess(json.cancel_token);
    } catch {
      toast.error("Síťová chyba. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wider";
  const errorClass = "text-xs text-red-600 mt-1";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-lg border border-gray-100 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold">{cancelToken ? "Změna termínu" : "Nová rezervace"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={labelClass}>Jméno *</label>
            <input {...register("name")} className={inputClass} placeholder="Jan Novák" />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>E-mail *</label>
            <input {...register("email")} type="email" className={inputClass} placeholder="jan@example.cz" />
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Telefon</label>
            <input {...register("phone")} type="tel" className={inputClass} placeholder="+420 777 123 456" />
          </div>

          <div>
            <label className={labelClass}>Datum *</label>
            <input
              {...register("date")}
              type="date"
              className={inputClass}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              max={new Date(Date.now() + rules.max_days_ahead * 86400000).toISOString().slice(0, 10)}
            />
            {errors.date && <p className={errorClass}>{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Čas od *</label>
              <select {...register("time_from")} className={inputClass}>
                {startSlots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.time_from && <p className={errorClass}>{errors.time_from.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Čas do *</label>
              <select {...register("time_to")} className={inputClass}>
                {endSlots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.time_to && <p className={errorClass}>{errors.time_to.message}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Poznámka</label>
            <textarea
              {...register("note")}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Libovolná poznámka (max 300 znaků)"
            />
            {errors.note && <p className={errorClass}>{errors.note.message}</p>}
          </div>

          <div className="flex items-start gap-2">
            <input
              {...register("consent")}
              type="checkbox"
              id="consent"
              className="mt-0.5 accent-black"
            />
            <label htmlFor="consent" className="text-sm text-gray-600 cursor-pointer">
              Souhlasím se zasláním potvrzovacího e-mailu *
            </label>
          </div>
          {errors.consent && <p className={errorClass}>{errors.consent.message}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onCancel} className="flex-1">
              Zpět
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Rezervovat
            </Button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}
