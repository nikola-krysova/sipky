import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deleteGoogleEvent, createGoogleEvent } from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Neplatný požadavek" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { token, name, email, phone, date, time_from, time_to, note } = body;

  if (!token || !date || !time_from || !time_to) {
    return new Response(JSON.stringify({ error: "Chybějící povinná pole" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch original reservation
  const { data: original, error: fetchError } = await supabase
    .from("reservations")
    .select("*")
    .eq("cancel_token", token)
    .single();

  if (fetchError || !original) {
    return new Response(JSON.stringify({ error: "Rezervace nenalezena" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (original.status === "cancelled") {
    return new Response(JSON.stringify({ error: "Rezervace již byla zrušena" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch settings and validate
  const [{ data: ohRow }, { data: rrRow }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "opening_hours").single(),
    supabase.from("settings").select("value").eq("key", "reservation_rules").single(),
  ]);

  if (!ohRow || !rrRow) {
    return new Response(JSON.stringify({ error: "Nastavení nenalezeno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const openingHours = ohRow.value;
  const rules = rrRow.value;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + rules.min_days_ahead);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + rules.max_days_ahead);
  const reservDate = new Date(date);
  reservDate.setHours(0, 0, 0, 0);

  if (reservDate < minDate || reservDate > maxDate) {
    return new Response(JSON.stringify({ error: "Datum mimo povolený rozsah" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayKey = dayNames[reservDate.getDay()];
  const dayHours = openingHours[dayKey];

  if (dayHours.closed) {
    return new Response(JSON.stringify({ error: "V tento den je restaurace zavřená" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fromMin = parseTime(time_from);
  const toMin = parseTime(time_to === "24:00" ? "00:00" : time_to) + (time_to === "24:00" ? 24*60 : 0);
  const openMin = parseTime(dayHours.open);
  const closeMin = parseTime(dayHours.close === "24:00" ? "00:00" : dayHours.close) + (dayHours.close === "24:00" ? 24*60 : 0);

  if (fromMin < openMin || toMin > closeMin) {
    return new Response(JSON.stringify({ error: "Čas mimo otevírací dobu" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const duration = toMin - fromMin;
  if (duration < rules.min_duration_minutes || duration > rules.max_duration_minutes) {
    return new Response(JSON.stringify({ error: `Délka musí být ${rules.min_duration_minutes}–${rules.max_duration_minutes} minut` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Collision check (exclude current reservation)
  const { data: conflicts } = await supabase
    .from("reservations")
    .select("id")
    .eq("date", date)
    .eq("status", "active")
    .neq("id", original.id)
    .or(`and(time_from.lt.${time_to},time_to.gt.${time_from})`);

  if (conflicts && conflicts.length > 0) {
    return new Response(JSON.stringify({ error: "Tento termín je již obsazen" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Blocked slots check
  const { data: blockedConflicts } = await supabase
    .from("blocked_slots")
    .select("id")
    .eq("date", date)
    .or(`and(time_from.lt.${time_to},time_to.gt.${time_from})`);

  if (blockedConflicts && blockedConflicts.length > 0) {
    return new Response(JSON.stringify({ error: "Tento termín je zablokován" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cancel old, create new
  await supabase.from("reservations").update({ status: "cancelled" }).eq("id", original.id);

  const { data: newReservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      name: name || original.name,
      email: email || original.email,
      phone: phone !== undefined ? phone : original.phone,
      date,
      time_from,
      time_to,
      note: note !== undefined ? note : original.note,
      status: "active",
    })
    .select()
    .single();

  if (insertError || !newReservation) {
    return new Response(JSON.stringify({ error: "Chyba při vytváření nové rezervace" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Google Calendar
  const appUrl = Deno.env.get("APP_URL") ?? "";
  if (original.google_event_id) {
    await deleteGoogleEvent(original.google_event_id);
  }
  const googleEventId = await createGoogleEvent({
    name: newReservation.name,
    email: newReservation.email,
    phone: newReservation.phone,
    date: newReservation.date,
    time_from: newReservation.time_from,
    time_to: newReservation.time_to,
    note: newReservation.note,
    cancel_url: `${appUrl}/rezervace/${newReservation.cancel_token}`,
  });
  if (googleEventId) {
    await supabase.from("reservations").update({ google_event_id: googleEventId }).eq("id", newReservation.id);
  }

  // Send confirmation email
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (resendKey) {
    const fmt = (d: string) => { const [y,m,day] = d.split("-"); return `${day}. ${m}. ${y}`; };
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
        to: [newReservation.email],
        subject: `Změna termínu rezervace – nový termín ${fmt(date)}`,
        html: buildChangeEmail({
          name: newReservation.name,
          old_date: fmt(original.date),
          old_time_from: original.time_from,
          old_time_to: original.time_to,
          new_date: fmt(date),
          new_time_from: time_from,
          new_time_to: time_to,
          cancel_token: newReservation.cancel_token,
          appUrl,
        }),
      }),
    });
  }

  return new Response(
    JSON.stringify({ id: newReservation.id, cancel_token: newReservation.cancel_token }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

function buildChangeEmail({ name, old_date, old_time_from, old_time_to, new_date, new_time_from, new_time_to, cancel_token, appUrl }: any) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#F9F9F9;font-family:Arial,sans-serif;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#fff;padding:32px 40px 20px;border-bottom:1px solid #eee;text-align:center;">
      <h1 style="font-family:Georgia,serif;font-size:28px;margin:0;color:#000;">Restaurace U Školy</h1>
      <p style="color:#666;font-size:13px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Milešovice</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#333;font-size:16px;">Dobrý den, <strong>${name}</strong>,</p>
      <p style="color:#333;font-size:15px;">Váš termín byl úspěšně změněn.</p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:20px;margin:24px 0;">
        <p style="color:#666;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Původní termín</p>
        <p style="color:#999;font-size:14px;text-decoration:line-through;margin:0;">${old_date} · ${old_time_from}–${old_time_to}</p>
        <p style="color:#666;font-size:13px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:1px;">Nový termín</p>
        <p style="color:#000;font-size:16px;font-weight:600;margin:0;">${new_date} · ${new_time_from}–${new_time_to}</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}/rezervace/${cancel_token}" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Spravovat rezervaci</a>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Restaurace U Školy, Milešovice · © ${new Date().getFullYear()}</p>
    </div>
  </div>
</div>
</body></html>`;
}
