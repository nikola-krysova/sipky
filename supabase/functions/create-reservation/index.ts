import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createGoogleEvent } from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limiter: IP -> [timestamps]
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5;
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Příliš mnoho požadavků. Zkuste to za hodinu." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  const { name, email, phone, date, time_from, time_to, note } = body;

  // Basic validation
  if (!name || !email || !date || !time_from || !time_to) {
    return new Response(JSON.stringify({ error: "Chybějící povinná pole" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Neplatný e-mail" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch settings
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

  // Date range validation
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

  // Opening hours validation
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

  // Collision check
  const { data: conflicts } = await supabase
    .from("reservations")
    .select("id")
    .eq("date", date)
    .eq("status", "active")
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

  // Insert reservation
  const { data: reservation, error: insertError } = await supabase
    .from("reservations")
    .insert({ name, email, phone: phone || null, date, time_from, time_to, note: note || null, status: "active" })
    .select()
    .single();

  if (insertError || !reservation) {
    return new Response(JSON.stringify({ error: "Chyba při vytváření rezervace" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Google Calendar
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const googleEventId = await createGoogleEvent({
    name: reservation.name,
    email: reservation.email,
    phone: reservation.phone,
    date: reservation.date,
    time_from: reservation.time_from,
    time_to: reservation.time_to,
    note: reservation.note,
    cancel_url: `${appUrl}/rezervace/${reservation.cancel_token}`,
  });
  if (googleEventId) {
    await supabase.from("reservations").update({ google_event_id: googleEventId }).eq("id", reservation.id);
  }

  // Send emails via Resend
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";

  if (resendKey) {
    const formatDate = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}. ${m}. ${y}`;
    };

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
        to: [email],
        subject: `Potvrzení rezervace šipek – ${formatDate(date)} ${time_from}`,
        html: buildCustomerEmail({ name, date, time_from, time_to, note, cancel_token: reservation.cancel_token, appUrl }),
      }),
    });

    if (adminEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
          to: [adminEmail],
          subject: `Nová rezervace šipek – ${formatDate(date)} ${time_from} (${name})`,
          html: buildAdminEmail({ name, email, phone, date, time_from, time_to, note, appUrl }),
        }),
      });
    }
  }

  return new Response(
    JSON.stringify({ id: reservation.id, cancel_token: reservation.cancel_token }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

function buildCustomerEmail({ name, date, time_from, time_to, note, cancel_token, appUrl }: any) {
  const [y, m, d] = date.split("-");
  const formattedDate = `${d}. ${m}. ${y}`;
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
      <p style="color:#333;font-size:16px;margin:0 0 24px;">Dobrý den, <strong>${name}</strong>,</p>
      <p style="color:#333;font-size:15px;margin:0 0 20px;">Vaše rezervace šipkového terče byla úspěšně vytvořena.</p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Datum:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${formattedDate}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Čas:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${time_from} – ${time_to}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Místo:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">Restaurace U Školy, Milešovice</td></tr>
          ${note ? `<tr><td style="padding:8px 0;color:#666;font-size:14px;">Poznámka:</td><td style="padding:8px 0;font-size:14px;">${note}</td></tr>` : ""}
        </table>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}/rezervace/${cancel_token}" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Spravovat rezervaci</a>
      </div>
      <p style="color:#333;font-size:15px;margin:0;">Těšíme se na vaši návštěvu!</p>
      <p style="color:#666;font-size:14px;margin:8px 0 0;">Tým Restaurace U Školy</p>
    </div>
    <div style="background:#f5f5f5;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Restaurace U Školy, Milešovice · © ${new Date().getFullYear()}</p>
    </div>
  </div>
</div>
</body></html>`;
}

function buildAdminEmail({ name, email, phone, date, time_from, time_to, note, appUrl }: any) {
  const [y, m, d] = date.split("-");
  const formattedDate = `${d}. ${m}. ${y}`;
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#F9F9F9;font-family:Arial,sans-serif;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#000;padding:20px 40px;text-align:center;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0;color:#fff;">Nová rezervace šipek</h1>
    </div>
    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;font-size:14px;width:120px;">Jméno:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">E-mail:</td><td style="padding:8px 0;font-size:14px;">${email}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">Telefon:</td><td style="padding:8px 0;font-size:14px;">${phone || "neuvedeno"}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">Datum:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${formattedDate}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">Čas:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${time_from} – ${time_to}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:14px;">Poznámka:</td><td style="padding:8px 0;font-size:14px;">${note || "–"}</td></tr>
      </table>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}/admin" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Otevřít admin</a>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}
