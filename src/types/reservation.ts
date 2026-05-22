export interface Reservation {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  time_from: string;
  time_to: string;
  note?: string;
  status: "active" | "cancelled";
  cancel_token: string;
  reminder_sent: boolean;
  recurring_group_id?: string | null;
  google_event_id?: string | null;
}

export interface BlockedSlot {
  id: string;
  created_at: string;
  date: string;
  time_from: string;
  time_to: string;
  label: string;
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface ReservationRules {
  min_duration_minutes: number;
  max_duration_minutes: number;
  slot_granularity_minutes: number;
  min_days_ahead: number;
  max_days_ahead: number;
}

export interface Settings {
  opening_hours: OpeningHours;
  reservation_rules: ReservationRules;
}

export interface ReservationFormData {
  name: string;
  email: string;
  phone?: string;
  date: string;
  time_from: string;
  time_to: string;
  note?: string;
  consent: boolean;
}

export type DayKey = keyof OpeningHours;
