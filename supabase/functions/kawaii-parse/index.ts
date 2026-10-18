// Mi Día Kawaii: convierte un texto libre en tareas usando Gemini.
// La clave GEMINI_API_KEY se guarda como secreto de Supabase; nunca llega al navegador.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CATS = ["general", "ejercicio", "medico", "estudio", "trabajo", "compras", "casa", "cuidado", "social"];
const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MODELS = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "OBJECT",
  properties: {
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          cat: { type: "STRING", enum: CATS },
          time: { type: "STRING", description: "HH:MM en 24 h, o vacío" },
          repeat: { type: "STRING", enum: ["once", "daily", "weekly", "dates"] },
          date: { type: "STRING", description: "YYYY-MM-DD si repeat=once" },
          days: { type: "ARRAY", items: { type: "INTEGER" }, description: "0=lunes … 6=domingo si repeat=weekly" },
          dates: { type: "ARRAY", items: { type: "STRING" }, description: "YYYY-MM-DD si repeat=dates" },
        },
        required: ["title", "cat", "repeat"],
      },
    },
    note: { type: "STRING", description: "Breve aviso si algo no se entendió; vacío si todo bien" },
  },
  required: ["tasks"],
};

function prompt(today: string, weekday: number) {
  return `Eres el asistente de una agenda en español. Conviertes lo que escribe la usuaria en tareas.
Hoy es ${DAYS[weekday]} ${today}. La semana empieza el lunes.
Categorías: general, ejercicio (pilates, gym, yoga, correr…), medico (médico, dentista, fisio, análisis, cita sanitaria…),
estudio, trabajo (trabajo, turno, curro, reunión…), compras, casa (limpiar, lavadora, cocinar…), cuidado (agua, skincare, dormir, medicación…), social (planes, quedadas, cumpleaños, cena…).
Reglas:
- "todos los días" → repeat=daily.
- Días de la semana que se repiten ("los lunes y miércoles", "de lunes a viernes") → repeat=weekly con days (0=lunes … 6=domingo).
- Fechas concretas o rangos ("el 3, 4 y 10", "del 3 al 7", "el jueves 23") → repeat=dates con todas las fechas YYYY-MM-DD expandidas; si es una sola fecha usa repeat=once con date.
- Sin mes indicado: el mes actual, salvo que el día ya haya pasado este mes, entonces el mes siguiente. "Mañana", "pasado mañana", "el viernes", "la semana que viene" se calculan desde hoy.
- Horas: "a las 6 de la tarde" → 18:00, "a las 9" sin más contexto de mañana → 09:00, "por la tarde" sin hora → vacío.
- title corto y bonito, con mayúscula inicial, sin la fecha ni la hora (p. ej. "Pilates", "Turno de trabajo", "Cita con la dentista").
- Una tarea por actividad distinta. No inventes tareas que no estén en el texto.
- Si algo no se entiende, ponlo en note en una frase corta.`;
}

const okDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

function clean(raw: any) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, 40) : [];
  const out = [];
  for (const t of tasks) {
    const title = String(t?.title ?? "").trim().slice(0, 80);
    if (!title) continue;
    const cat = CATS.includes(t?.cat) ? t.cat : "general";
    const time = typeof t?.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ? t.time : "";
    let repeat = ["once", "daily", "weekly", "dates"].includes(t?.repeat) ? t.repeat : "once";
    const task: Record<string, unknown> = { title, cat, time, repeat };
    if (repeat === "weekly") {
      const days = [...new Set((t.days || []).filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort();
      if (!days.length) continue;
      task.days = days;
    } else if (repeat === "dates") {
      const dates = [...new Set((t.dates || []).filter(okDate))].sort().slice(0, 120);
      if (!dates.length) continue;
      if (dates.length === 1) { task.repeat = "once"; task.date = dates[0]; } else task.dates = dates;
    } else if (repeat === "once") {
      if (!okDate(t.date)) continue;
      task.date = t.date;
    }
    out.push(task);
  }
  return { tasks: out, note: typeof raw?.note === "string" ? raw.note.slice(0, 200) : "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Solo usuarias con sesión iniciada pueden usar la cuota de Gemini
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !u?.user) return json({ error: "login" }, 401);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "no_key" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const text = String(body?.text ?? "").trim().slice(0, 3000);
  const today = okDate(body?.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = Number.isInteger(body?.weekday) && body.weekday >= 0 && body.weekday <= 6 ? body.weekday : 0;
  if (!text) return json({ error: "empty" }, 400);

  const payload = {
    systemInstruction: { parts: [{ text: prompt(today, weekday) }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: SCHEMA },
  };

  let lastErr = "";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
    });
    if (r.status === 404) { lastErr = `model ${model} not found`; continue; }
    if (r.status === 429) return json({ error: "quota" }, 429);
    if (!r.ok) { lastErr = `${r.status} ${(await r.text()).slice(0, 300)}`; break; }
    const data = await r.json();
    const out = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    try { return json(clean(JSON.parse(out))); }
    catch { return json({ error: "parse" }, 502); }
  }
  console.error("gemini error:", lastErr);
  return json({ error: "gemini" }, 502);
});
