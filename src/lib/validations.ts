import { z } from "zod";
import {
  format,
  addDays,
  parseISO,
  isAfter,
  isBefore,
  differenceInMinutes,
  parse,
} from "date-fns";
import type { OpeningHours, ReservationRules, DayKey } from "../types/reservation";

export const reservationSchema = z.object({
  name: z.string().min(2, "Jméno musí mít alespoň 2 znaky"),
  email: z.string().email("Neplatný formát e-mailu"),
  phone: z.string().optional(),
  date: z.string().min(1, "Vyberte datum"),
  time_from: z.string().min(1, "Vyberte čas začátku"),
  time_to: z.string().min(1, "Vyberte čas konce"),
  note: z.string().max(300, "Poznámka max 300 znaků").optional(),
  consent: z.literal(true, { message: "Souhlas je povinný" }),
});

export type ReservationSchema = z.infer<typeof reservationSchema>;

export const DAY_NAMES: Record<number, DayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export function getOpeningHoursForDate(
  date: string,
  openingHours: OpeningHours
): { open: string; close: string; closed: boolean } {
  const d = parseISO(date);
  const dayKey = DAY_NAMES[d.getDay()];
  const hours = openingHours[dayKey];
  return {
    open: hours.open,
    close: hours.close,
    closed: hours.closed ?? false,
  };
}

export function generateTimeSlots(
  open: string,
  close: string,
  granularityMinutes: number
): string[] {
  const slots: string[] = [];
  const baseDate = new Date(2000, 0, 1);
  const [openH, openM] = open.split(":").map(Number);
  const closeTime =
    close === "24:00" ? new Date(2000, 0, 2, 0, 0) : parse(close, "HH:mm", baseDate);
  let current = new Date(baseDate.setHours(openH, openM, 0, 0));

  while (isBefore(current, closeTime)) {
    slots.push(format(current, "HH:mm"));
    current = new Date(current.getTime() + granularityMinutes * 60 * 1000);
  }
  return slots;
}

export function generateEndTimeSlots(
  timeFrom: string,
  close: string,
  minDuration: number,
  maxDuration: number
): string[] {
  const slots: string[] = [];
  const base = new Date(2000, 0, 1);
  const [fH, fM] = timeFrom.split(":").map(Number);
  const fromTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), fH, fM);
  const closeTime =
    close === "24:00"
      ? new Date(2000, 0, 2, 0, 0)
      : parse(close, "HH:mm", base);

  const earliest = new Date(fromTime.getTime() + minDuration * 60 * 1000);
  const latest = new Date(fromTime.getTime() + maxDuration * 60 * 1000);
  const end = isBefore(latest, closeTime) ? latest : closeTime;

  let current = earliest;
  while (!isAfter(current, end)) {
    slots.push(
      format(
        current.getDate() > base.getDate()
          ? new Date(2000, 0, 2, current.getHours(), current.getMinutes())
          : current,
        "HH:mm"
      )
    );
    current = new Date(current.getTime() + 30 * 60 * 1000);
  }
  return slots;
}

export function validateReservationDates(
  date: string,
  rules: ReservationRules
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = addDays(today, rules.min_days_ahead);
  const maxDate = addDays(today, rules.max_days_ahead);
  const d = parseISO(date);

  if (isBefore(d, minDate)) {
    return `Rezervovat lze nejdříve ${format(minDate, "d. M. yyyy")}`;
  }
  if (isAfter(d, maxDate)) {
    return `Rezervovat lze nejpozději ${format(maxDate, "d. M. yyyy")}`;
  }
  return null;
}

export function validateTimeRange(
  timeFrom: string,
  timeTo: string,
  open: string,
  close: string,
  rules: ReservationRules
): string | null {
  const base = new Date(2000, 0, 1);

  const parseTime = (t: string) => {
    if (t === "24:00") return new Date(2000, 0, 2, 0, 0);
    return parse(t, "HH:mm", base);
  };

  const from = parseTime(timeFrom);
  const to = parseTime(timeTo);
  const openTime = parseTime(open);
  const closeTime = parseTime(close);

  if (isBefore(from, openTime) || isAfter(from, closeTime)) {
    return "Čas začátku je mimo otevírací dobu";
  }
  if (isAfter(to, closeTime)) {
    return "Čas konce je mimo otevírací dobu";
  }

  const diff = differenceInMinutes(to, from);
  if (diff < rules.min_duration_minutes) {
    return `Minimální délka rezervace je ${rules.min_duration_minutes} minut`;
  }
  if (diff > rules.max_duration_minutes) {
    return `Maximální délka rezervace je ${rules.max_duration_minutes} minut`;
  }
  return null;
}

export function formatDate(date: string): string {
  return format(parseISO(date), "d. M. yyyy");
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}
