// Mi Día Kawaii ↔ Google Calendar
// GET  ?t=<token>            → calendario .ics con tus tareas (para suscribirse desde Google Calendar)
// POST {url, from, to} + JWT → lee tu calendario de Google (dirección secreta iCal) y devuelve sus eventos
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const TZ = "Europe/Madrid";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// ---------- fechas (en días locales YYYY-MM-DD) ----------
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (k: string) => new Date(k + "T00:00:00Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const weekIdx = (d: Date) => (d.getUTCDay() + 6) % 7;
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// ---------- exportar: tareas → .ics ----------
function occursOn(t: any, key: string): boolean {
  if (t.repeat === "once") return t.date === key;
  if (t.repeat === "none") return false;
  if (t.repeat === "dates") return (t.dates || []).includes(key) && !(t.skip || []).includes(key);
  if (t.from && key < t.from) return false;
  if ((t.skip || []).includes(key)) return false;
  if (t.repeat === "daily") return true;
  if (t.repeat === "weekly") return (t.days || []).includes(weekIdx(parse(key)));
  return false;
}
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string) { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); }

async function exportIcs(token: string) {
  if (!/^[a-f0-9]{36}$/.test(token)) return new Response("not found", { status: 404, headers: cors });
  const { data: row } = await admin.from("kawaii_ical").select("user_id").eq("token", token).maybeSingle();
  if (!row) return new Response("not found", { status: 404, headers: cors });
  const { data: st } = await admin.from("kawaii_state").select("data").eq("user_id", row.user_id).maybeSingle();
  const { data: spaces } = await admin.from("kawaii_space").select("data,members").contains("members", [row.user_id]);
  const mine = (st?.data?.tasks || []).map((t: any) => ({ t, done: st?.data?.done || {} }));
  const shared = (spaces || []).flatMap((s: any) => (s.data?.tasks || []).map((t: any) => ({ t, done: s.data?.done || {} })));
  const start = addDays(parse(todayLocal()), -14), stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mi Dia Kawaii//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Mi Día Kawaii 🎀", `X-WR-TIMEZONE:${TZ}`];
  for (let i = 0; i < 120; i++) {
    const key = ymd(addDays(start, i));
    for (const { t, done } of [...mine, ...shared]) {
      if (t.repeat === "daily" || !occursOn(t, key)) continue; // las rutinas diarias no se exportan (llenarían el calendario)
      const time = (t.times && t.times[key]) || t.time || "";
      const d8 = key.replace(/-/g, ""), isDone = (done[key] || []).includes(t.id);
      lines.push("BEGIN:VEVENT", `UID:${t.id}-${d8}@midiakawaii`, `DTSTAMP:${stamp}`);
      if (/^\d{2}:\d{2}$/.test(time)) {
        const [h, m] = time.split(":").map(Number), end = h * 60 + m + 60;
        lines.push(`DTSTART;TZID=${TZ}:${d8}T${pad(h)}${pad(m)}00`,
          end < 1440 ? `DTEND;TZID=${TZ}:${d8}T${pad(Math.floor(end / 60))}${pad(end % 60)}00` : `DTEND;TZID=${TZ}:${d8}T235900`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${d8}`, `DTEND;VALUE=DATE:${ymd(addDays(parse(key), 1)).replace(/-/g, "")}`);
      }
      lines.push(fold(`SUMMARY:${icsText((isDone ? "✓ " : "") + (t.shared ? "💞 " : "") + String(t.title || ""))}`), "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}

// ---------- importar: .ics de Google → eventos ----------
const ALLOWED = [/^calendar\.google\.com$/, /^(outlook\.live|outlook\.office365|outlook\.office)\.com$/, /^p\d+-caldav\.icloud\.com$/];
function localParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
// DTSTART en sus formatos: fecha, hora UTC (Z) u hora local
function parseDt(prop: string, val: string) {
  if (/VALUE=DATE/.test(prop) || /^\d{8}$/.test(val)) return { date: `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`, time: "", allDay: true };
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/); if (!m) return null;
  if (val.endsWith("Z")) { const l = localParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))); return { ...l, allDay: false }; }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false };
}
const DAYMAP: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
function expand(ev: any, from: string, to: string) {
  const out: string[] = [];
  if (!ev.rrule) { if (ev.date >= from && ev.date <= to) out.push(ev.date); return out; }
  const r = Object.fromEntries(ev.rrule.split(";").map((x: string) => x.split("=")));
  const interval = Number(r.INTERVAL || 1), count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : "9999-12-31";
  const byday = r.BYDAY ? r.BYDAY.split(",").map((x: string) => DAYMAP[x.slice(-2)]).filter((x: number) => x !== undefined) : null;
  const start = parse(ev.date); let n = 0;
  for (let i = 0; i < 800 && n < count; i++) {
    const d = addDays(start, i), k = ymd(d);
    if (k > until || k > to) break;
    const daysFrom = i;
    let hit = false;
    if (r.FREQ === "DAILY") hit = daysFrom % interval === 0;
    else if (r.FREQ === "WEEKLY") hit = Math.floor(daysFrom / 7) % interval === 0 && (byday ? byday.includes(weekIdx(d)) : weekIdx(d) === weekIdx(start));
    else if (r.FREQ === "MONTHLY") hit = d.getUTCDate() === start.getUTCDate() && ((d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth()) % interval === 0;
    else if (r.FREQ === "YEARLY") hit = d.getUTCDate() === start.getUTCDate() && d.getUTCMonth() === start.getUTCMonth();
    if (!hit) continue;
    n++;
    if (k >= from && !ev.exdates.includes(k)) out.push(k);
  }
  return out;
}
async function importIcs(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user) return json({ error: "login" }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let url: URL; try { url = new URL(String(body.url || "").trim().replace(/^webcal:/i, "https:")); } catch { return json({ error: "bad_url" }, 400); }
  if (url.protocol !== "https:" || !ALLOWED.some(re => re.test(url.hostname))) return json({ error: "bad_url" }, 400);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from) ? body.from : ymd(addDays(parse(todayLocal()), -7));
  const to = /^\d{4}-\d{2}-\d{2}$/.test(body.to) ? body.to : ymd(addDays(parse(todayLocal()), 60));
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return json({ error: "fetch" }, 502);
  const text = (await res.text()).slice(0, 3_000_000).replace(/\r?\n[ \t]/g, "");
  const events: any[] = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const body2 = block.split("END:VEVENT")[0];
    const get = (name: string) => { const m = body2.match(new RegExp(`^${name}([^:\\r\\n]*):(.*)$`, "m")); return m ? [m[1], m[2].trim()] : null; };
    const ds = get("DTSTART"), sum = get("SUMMARY"); if (!ds) continue;
    const dt = parseDt(ds[0], ds[1]); if (!dt) continue;
    if (/^STATUS:CANCELLED/m.test(body2)) continue;
    const rr = get("RRULE"), ex = [...body2.matchAll(/^EXDATE[^:]*:(.*)$/gm)].flatMap(m => m[1].split(",").map(v => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`));
    const title = (sum ? sum[1] : "(sin título)").replace(/\\n/g, " ").replace(/\\([,;\\])/g, "$1").slice(0, 120);
    for (const k of expand({ date: dt.date, rrule: rr && rr[1], exdates: ex }, from, to)) {
      events.push({ date: k, time: dt.time, allDay: dt.allDay, title });
      if (events.length >= 600) break;
    }
  }
  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return json({ events });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return exportIcs(new URL(req.url).searchParams.get("t") || "");
  if (req.method === "POST") return importIcs(req);
  return json({ error: "method" }, 405);
});
