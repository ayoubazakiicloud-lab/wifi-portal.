import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Format de l’attribut FreeRADIUS « Expiration » : « Nov 12 2026 18:30:00 » (UTC).
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
const radiusDate = (d: Date) =>
  `${MONTHS[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail("server", 500);

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return fail("invalid_format", 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: v, error } = await sb
    .from("vouchers")
    .select("code,status,first_used_at,expires_at,plans(duration_minutes)")
    .eq("code", code)
    .maybeSingle();

  if (error) return fail("server", 500);
  if (!v) return fail("not_found", 404);
  if (v.status === "disabled") return fail("disabled", 403);
  if (v.status === "expired" || (v.expires_at && new Date(v.expires_at) < new Date())) {
    if (v.status !== "expired") await sb.from("vouchers").update({ status: "expired" }).eq("code", code);
    return fail("expired", 403);
  }

  // Première utilisation : démarre le compte à rebours, appliqué aussi côté RADIUS.
  if (!v.first_used_at) {
    const plan = v.plans as unknown as { duration_minutes: number };
    const expires = new Date(Date.now() + plan.duration_minutes * 60_000);
    const [a, b] = await Promise.all([
      sb.from("vouchers").update({ status: "active", first_used_at: new Date().toISOString(), expires_at: expires.toISOString() }).eq("code", code),
      sb.from("radcheck").insert({ username: code, attribute: "Expiration", op: ":=", value: radiusDate(expires) }),
    ]);
    if (a.error || b.error) return fail("server", 500);
  }

  return NextResponse.json({ ok: true, username: code, password: code }, { headers: { "Cache-Control": "no-store" } });
}
