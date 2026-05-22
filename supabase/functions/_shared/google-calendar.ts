interface CalendarEvent {
  name: string;
  email: string;
  phone?: string | null;
  date: string;
  time_from: string;
  time_to: string;
  note?: string | null;
  cancel_url: string;
}

async function getAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.access_token ?? null;
}

export async function createGoogleEvent(event: CalendarEvent): Promise<string | null> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  if (!calendarId) return null;
  const token = await getAccessToken();
  if (!token) return null;

  const body = {
    summary: `Šipky – ${event.name}`,
    description: [
      `E-mail: ${event.email}`,
      event.phone ? `Telefon: ${event.phone}` : null,
      event.note ? `Poznámka: ${event.note}` : null,
      `Odkaz: ${event.cancel_url}`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: `${event.date}T${event.time_to === "24:00" ? "00:00" : event.time_from}:00`, timeZone: "Europe/Prague" },
    end: { dateTime: `${event.date}T${event.time_to === "24:00" ? "00:00" : event.time_to}:00`, timeZone: "Europe/Prague" },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.id ?? null;
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  if (!calendarId) return;
  const token = await getAccessToken();
  if (!token) return;
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function updateGoogleEvent(eventId: string, event: CalendarEvent): Promise<void> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  if (!calendarId) return;
  const token = await getAccessToken();
  if (!token) return;

  const body = {
    summary: `Šipky – ${event.name}`,
    description: [
      `E-mail: ${event.email}`,
      event.phone ? `Telefon: ${event.phone}` : null,
      event.note ? `Poznámka: ${event.note}` : null,
      `Odkaz: ${event.cancel_url}`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: `${event.date}T${event.time_from}:00`, timeZone: "Europe/Prague" },
    end: { dateTime: `${event.date}T${event.time_to === "24:00" ? "00:00" : event.time_to}:00`, timeZone: "Europe/Prague" },
  };

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}
