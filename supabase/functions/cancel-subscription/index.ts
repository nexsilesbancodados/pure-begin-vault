// deno-lint-ignore-file
// Cancela a assinatura: marca canceled no DB + cancela preapproval no MP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u, error: e } = await userClient.auth.getUser();
    if (e || !u.user) return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });

    const body = await req.json().catch(() => ({}));
    const subscriptionId = body.subscription_id as string | undefined;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let q = admin.from("subscriptions").select("*").eq("user_id", u.user.id);
    if (subscriptionId) q = q.eq("id", subscriptionId);
    else q = q.in("status", ["active", "pending", "trial", "past_due"]);
    const { data: subs, error: subErr } = await q;
    if (subErr) throw subErr;

    let canceledMp = 0;
    let canceledLocal = 0;
    const errors: string[] = [];

    for (const sub of subs ?? []) {
      if (sub.mp_preapproval_id) {
        try {
          const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (res.ok) canceledMp += 1;
          else {
            const errBody = await res.text();
            console.warn(`MP cancel ${sub.mp_preapproval_id}:`, res.status, errBody);
            errors.push(`mp_${sub.id}: ${res.status}`);
          }
        } catch (e) {
          errors.push(`mp_${sub.id}: ${(e as Error).message}`);
        }
      }

      const { error } = await admin.from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (!error) canceledLocal += 1;
    }

    return new Response(JSON.stringify({
      ok: true,
      canceled_local: canceledLocal,
      canceled_mp: canceledMp,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
