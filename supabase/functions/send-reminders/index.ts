import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("date", tomorrowStr)
    .eq("status", "active")
    .eq("reminder_sent", false);

  if (error || !reservations?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "";
  let sent = 0;

  for (const r of reservations) {
    if (!resendKey) continue;
    const [y, m, d] = r.date.split("-");
    const formattedDate = `${d}. ${m}. ${y}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Restaurace U Školy <noreply@restauraceuskoly.cz>",
        to: [r.email],
        subject: "Připomínka: zítra máte rezervaci šipek",
        html: buildReminderEmail({ name: r.name, date: formattedDate, time_from: r.time_from, time_to: r.time_to, cancel_token: r.cancel_token, appUrl }),
      }),
    });

    await supabase.from("reservations").update({ reminder_sent: true }).eq("id", r.id);
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});

function buildReminderEmail({ name, date, time_from, time_to, cancel_token, appUrl }: any) {
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
      <p style="color:#333;font-size:15px;">Připomínáme vám, že zítra máte rezervován šipkový terč.</p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Datum:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Čas:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${time_from} – ${time_to}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Místo:</td><td style="padding:8px 0;font-weight:600;font-size:14px;">Restaurace U Školy, Milešovice</td></tr>
        </table>
      </div>
      <p style="color:#555;font-size:14px;">Pokud se nemůžete dostavit, zrušte prosím rezervaci:</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${appUrl}/rezervace/${cancel_token}" style="background:#000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Zrušit rezervaci</a>
      </div>
      <p style="color:#333;font-size:15px;">Těšíme se na vás!</p>
    </div>
    <div style="background:#f5f5f5;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Restaurace U Školy, Milešovice · © ${new Date().getFullYear()}</p>
    </div>
  </div>
</div>
</body></html>`;
}
