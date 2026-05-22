import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  const { token, by_admin } = body;
  if (!token) {
    return new Response(JSON.stringify({ error: "Token je povinný" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: reservation, error: fetchError } = await supabase
    .from("reservations")
    .select("*")
    .eq("cancel_token", token)
    .single();

  if (fetchError || !reservation) {
    return new Response(JSON.stringify({ error: "Rezervace nenalezena" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (reservation.status === "cancelled") {
    return new Response(JSON.stringify({ error: "Rezervace již byla zrušena" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservation.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: "Chyba při rušení rezervace" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Send cancellation email
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";

  if (resendKey) {
    const [y, m, d] = reservation.date.split("-");
    const formattedDate = `${d}. ${m}. ${y}`;
    const subject = by_admin
      ? `Zrušení vaší rezervace – ${formattedDate}`
      : `Vaše rezervace byla zrušena`;

    const html = by_admin
      ? buildAdminCancelEmail({ name: reservation.name, date: formattedDate, time_from: reservation.time_from, time_to: reservation.time_to, appUrl, adminEmail })
      : buildCustomerCancelEmail({ name: reservation.name, date: formattedDate, time_from: reservation.time_from, time_to: reservation.time_to, appUrl });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
        to: [reservation.email],
        subject,
        html,
      }),
    });

    if (by_admin && adminEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
          to: [adminEmail],
          subject: `Rezervace zrušena adminem – ${formattedDate} ${reservation.time_from}`,
          html: `<p>Admin zrušil rezervaci: ${reservation.name}, ${formattedDate} ${reservation.time_from}–${reservation.time_to}</p>`,
        }),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function buildCustomerCancelEmail({ name, date, time_from, time_to, appUrl }: any) {
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
      <p style="color:#333;font-size:15px;">Vaše rezervace šipkového terče na <strong>${date}</strong> v <strong>${time_from}–${time_to}</strong> byla úspěšně zrušena.</p>
      <p style="color:#333;font-size:15px;">Chcete si zarezervovat jiný termín?</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Vybrat nový termín</a>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Restaurace U Školy, Milešovice · © ${new Date().getFullYear()}</p>
    </div>
  </div>
</div>
</body></html>`;
}

function buildAdminCancelEmail({ name, date, time_from, time_to, appUrl, adminEmail }: any) {
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
      <p style="color:#333;font-size:15px;">S lítostí vám oznamujeme, že vaše rezervace šipkového terče na <strong>${date}</strong> v <strong>${time_from}–${time_to}</strong> musela být zrušena.</p>
      <p style="color:#333;font-size:15px;">Omlouváme se za způsobené nepříjemnosti.</p>
      <p style="color:#333;font-size:15px;">V případě dotazů nás kontaktujte na: <a href="mailto:${adminEmail}">${adminEmail}</a></p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Zarezervovat nový termín</a>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Restaurace U Školy, Milešovice · © ${new Date().getFullYear()}</p>
    </div>
  </div>
</div>
</body></html>`;
}
