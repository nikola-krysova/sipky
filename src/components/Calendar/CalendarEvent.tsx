import type { EventContentArg } from "@fullcalendar/core";

interface Props {
  eventInfo: EventContentArg;
}

export default function CalendarEvent({ eventInfo }: Props) {
  const { event } = eventInfo;
  const occupied = event.extendedProps.occupied;

  if (occupied) {
    return (
      <div className="px-1 py-0.5 text-xs font-medium text-red-800">
        <span>Obsazeno</span>
      </div>
    );
  }

  return (
    <div className="px-1 py-0.5 text-xs font-medium text-green-800">
      <span>{event.title}</span>
    </div>
  );
}
