/** Scripts de la configuración (una sola vez) de los avisos push con la app cerrada, sobre tu Supabase gratuito. */

/** Supabase le pone a la función una dirección propia (p. ej. «quick-handler») aunque la llames apex-push: se saca de su URL. */
export const slugFromUrl = (u: string): string => u.match(/\/functions\/v1\/([A-Za-z0-9_-]+)/)?.[1] ?? '';

export const pushCronSql = (url: string, anonKey: string, slug = 'apex-push'): string => `-- Programador de avisos (cada 10 segundos llama a tu función)
select cron.schedule('apex-push', '10 seconds', $$
  select net.http_post(
    url := '${url.trim().replace(/\/+$/, '')}/functions/v1/${slug}',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ${anonKey.trim()}"}'::jsonb,
    body := '{}'::jsonb
  );
$$);`;

export const pushSql = (url: string, anonKey: string): string => `-- Avisos push: tablas, funciones y programador (pégalo en Supabase → SQL Editor → Run)
create table if not exists public.apex_push_cfg (id int primary key, public_key text not null, private_key text not null);
create table if not exists public.apex_push_subs (device_id uuid primary key, sub jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.apex_push_jobs (
  device_id uuid not null, tag text not null, title text not null, body text not null,
  due_at timestamptz not null, sent boolean not null default false,
  primary key (device_id, tag)
);
alter table public.apex_push_cfg enable row level security;
alter table public.apex_push_subs enable row level security;
alter table public.apex_push_jobs enable row level security;

create or replace function public.apex_push_pubkey() returns text language sql security definer set search_path = public as $$
  select public_key from public.apex_push_cfg where id = 1;
$$;
create or replace function public.apex_push_register(p_device uuid, p_sub jsonb) returns void language sql security definer set search_path = public as $$
  insert into public.apex_push_subs (device_id, sub, updated_at) values (p_device, p_sub, now())
  on conflict (device_id) do update set sub = excluded.sub, updated_at = now();
$$;
create or replace function public.apex_push_schedule(p_device uuid, p_tag text, p_title text, p_body text, p_due timestamptz) returns void language sql security definer set search_path = public as $$
  insert into public.apex_push_jobs (device_id, tag, title, body, due_at, sent) values (p_device, p_tag, p_title, p_body, p_due, false)
  on conflict (device_id, tag) do update set title = excluded.title, body = excluded.body, due_at = excluded.due_at, sent = false;
$$;
create or replace function public.apex_push_cancel(p_device uuid, p_tag text) returns void language sql security definer set search_path = public as $$
  delete from public.apex_push_jobs where device_id = p_device and tag = p_tag and sent = false;
$$;
grant execute on function public.apex_push_pubkey() to anon;
grant execute on function public.apex_push_register(uuid, jsonb) to anon;
grant execute on function public.apex_push_schedule(uuid, text, text, text, timestamptz) to anon;
grant execute on function public.apex_push_cancel(uuid, text) to anon;

-- Programador: cada 10 segundos despierta la función «apex-push» (que envía los avisos que toquen).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('apex-push', '10 seconds', $$
  select net.http_post(
    url := '${url.trim().replace(/\/+$/, '')}/functions/v1/apex-push',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ${anonKey.trim()}"}'::jsonb,
    body := '{}'::jsonb
  );
$$);`;

export const PUSH_FUNCTION = `// Función «apex-push» (Supabase → Edge Functions → Deploy a new function). Envía los avisos que toquen.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Claves VAPID: se crean solas la primera vez.
  let { data: cfg } = await sb.from("apex_push_cfg").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (!cfg) {
    const k = webpush.generateVAPIDKeys();
    cfg = { public_key: k.publicKey, private_key: k.privateKey };
    await sb.from("apex_push_cfg").upsert({ id: 1, ...cfg });
  }
  webpush.setVapidDetails("mailto:avisos@apex-coach.app", cfg.public_key, cfg.private_key);

  const horizon = new Date(Date.now() + 9000).toISOString();
  const { data: jobs } = await sb.from("apex_push_jobs").select("device_id, tag, title, body, due_at").eq("sent", false).lte("due_at", horizon).limit(50);

  let sent = 0;
  for (const j of jobs ?? []) {
    const wait = new Date(j.due_at).getTime() - Date.now();
    if (wait > 0) await sleep(Math.min(wait, 9500)); // puntual al segundo (fin de descanso)
    // Se «reclama» el aviso de un solo golpe: si se canceló mientras esperábamos, o ya lo envió otra ejecución, no se envía (evita duplicados).
    const { data: claimed } = await sb.from("apex_push_jobs").update({ sent: true }).eq("device_id", j.device_id).eq("tag", j.tag).eq("sent", false).eq("due_at", j.due_at).select("tag");
    if (!claimed || claimed.length === 0) continue;
    const { data: sub } = await sb.from("apex_push_subs").select("sub").eq("device_id", j.device_id).maybeSingle();
    if (!sub) continue;
    try {
      await webpush.sendNotification(sub.sub, JSON.stringify({ title: j.title, body: j.body, tag: j.tag }), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("apex_push_subs").delete().eq("device_id", j.device_id);
    }
  }
  await sb.from("apex_push_jobs").delete().eq("sent", true).lt("due_at", new Date(Date.now() - 86400000).toISOString());
  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
`;
