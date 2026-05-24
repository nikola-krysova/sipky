import { useRef, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, DateSelectArg } from "@fullcalendar/core";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { supabase } from "../../lib/supabase";
import type { OpeningHours, ReservationRules } from "../../types/reservation";
import { DAY_NAMES } from "../../lib/validations";
import { CalendarSkeleton } from "../ui/Skeleton";
import CalendarEvent from "./CalendarEvent";

interface Props {
  openingHours: OpeningHours;
  rules: ReservationRules;
  onSelectSlot: (date: string, timeFrom: string) => void;
  excludeReservationId?: string;
}

export default function ReservationCalendar({
  openingHours,
  rules,
  onSelectSlot,
  excludeReservationId,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const eventsRef = useRef<EventInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const today = startOfDay(new Date());
  const minDate = addDays(today, rules.min_days_ahead);
  const maxDate = addDays(today, rules.max_days_ahead);

  const getSlotMinTime = () => {
    const allOpens = Object.values(openingHours).map((h) => h.open);
    return allOpens.sort()[0] || "14:00";
  };

  const getSlotMaxTime = () => {
    const allCloses = Object.values(openingHours).map((h) =>
      h.close === "24:00" ? "24:00" : h.close
    );
    return allCloses.sort().reverse()[0] || "24:00";
  };

  const buildBusinessHours = () => {
    return Object.entries(openingHours)
      .filter(([, h]) => !h.closed)
      .map(([day, h]) => {
        const jsDay = Object.keys(DAY_NAMES).find(
          (k) => DAY_NAMES[Number(k)] === day
        );
        return {
          daysOfWeek: [Number(jsDay)],
          startTime: h.open,
          endTime: h.close === "24:00" ? "24:00:00" : h.close,
        };
      });
  };

  const loadReservations = async () => {
    setLoading(true);
    const [{ data, error }, { data: blockedData }] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, date, time_from, time_to, status")
        .eq("status", "active"),
      supabase
        .from("blocked_slots")
        .select("id, date, time_from, time_to, label"),
    ]);

    if (!error && data) {
      type Row = { id: string; date: string; time_from: string; time_to: string; status: string };
      const evts: EventInput[] = (data as Row[])
        .filter((r) =>
          excludeReservationId ? r.id !== excludeReservationId : true
        )
        .map((r) => ({
          id: r.id,
          start: `${r.date}T${r.time_from}`,
          end: `${r.date}T${r.time_to === "24:00" ? "00:00" : r.time_to}`,
          title: "Obsazeno",
          classNames: ["fc-event-occupied"],
          extendedProps: { occupied: true },
        }));
      const blockedEvts: EventInput[] = (blockedData ?? []).map((b: any) => ({
        id: `blocked-${b.id}`,
        start: `${b.date}T${b.time_from}`,
        end: `${b.date}T${b.time_to === "24:00" ? "00:00" : b.time_to}`,
        title: b.label,
        classNames: ["fc-event-blocked"],
        extendedProps: { blocked: true },
      }));
      const allEvts = [...evts, ...blockedEvts];
      setEvents(allEvts);
      eventsRef.current = allEvts;
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReservations();

    const channel = supabase
      .channel("reservations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => loadReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [excludeReservationId]);

  const handleDateSelect = (info: DateSelectArg) => {
    const selectedDate = format(info.start, "yyyy-MM-dd");
    const selectedTime = format(info.start, "HH:mm");
    const dayKey = DAY_NAMES[info.start.getDay()];
    const hours = openingHours[dayKey];

    if (hours.closed) return;

    const d = parseISO(selectedDate);
    if (d < minDate || d > maxDate) return;

    const overlapsBlocked = eventsRef.current.some((e) => {
      if (!e.extendedProps?.blocked) return false;
      const eDate = String(e.start ?? "").slice(0, 10);
      if (eDate !== selectedDate) return false;
      const eStart = String(e.start ?? "").slice(11, 16);
      const eEnd = String(e.end ?? "").slice(11, 16);
      return selectedTime < eEnd && selectedTime >= eStart;
    });
    if (overlapsBlocked) return;

    onSelectSlot(selectedDate, selectedTime);
  };

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: isMobile ? "" : "timeGridWeek,timeGridDay",
        }}
        locale="cs"
        firstDay={1}
        slotMinTime={getSlotMinTime()}
        slotMaxTime={getSlotMaxTime()}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        snapDuration="00:30:00"
        selectable
        selectMirror
        unselectAuto
        validRange={{
          start: format(minDate, "yyyy-MM-dd"),
          end: format(addDays(maxDate, 1), "yyyy-MM-dd"),
        }}
        businessHours={buildBusinessHours()}
        events={events}
        select={handleDateSelect}
        eventContent={(arg) => <CalendarEvent eventInfo={arg} />}
        height="auto"
        expandRows
        nowIndicator
        allDaySlot={false}
        selectConstraint="businessHours"
        eventOverlap={false}
        selectOverlap={false}
      />
    </div>
  );
}
