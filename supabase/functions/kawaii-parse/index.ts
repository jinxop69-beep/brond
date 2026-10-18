// Mi Día Kawaii: convierte un texto libre en tareas usando Claude.
// La clave ANTHROPIC_API_KEY se guarda como secreto de Supabase; nunca llega al navegador.
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CATS = ["general", "ejercicio", "medico", "estudio", "trabajo", "compras", "casa", "cuidado", "social"];
const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
// Se puede cambiar sin tocar el código con el secreto CLAUDE_MODEL (p. ej. claude-haiku-5-5, más barato)
const MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-opus-5-5";
// Reintento automático en otro modelo si el filtro de seguridad rechaza la petición (no existe en Haiku)
const SUPPORTS_FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/.test(MODEL);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Esquema de salida (structured outputs): todos los campos obligatorios, vacíos cuando no aplican
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks", "note"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "cat", "time", "repeat", "date", "days", "dates"],
        properties: {
          title: { type: "string" },
          cat: { type: "string", enum: CATS },
          time: { type: "string", description: "HH:MM en 24 h, o cadena vacía" },
          repeat: { type: "string", enum: ["once", "daily", "weekly", "dates"] },
          date: { type: "string", description: "YYYY-MM-DD si repeat=once; si no, vacía" },
          days: { type: "array", items: { type: "integer" }, description: "0=lunes … 6=domingo si repeat=weekly; si no, []" },
          dates: { type: "array", items: { type: "string" }, description: "YYYY-MM-DD si repeat=dates; si no, []" },
        },
      },
    },
    note: { type: "string", description: "Aviso breve si algo no se entendió; vacía si todo bien" },
  },
};

const SYSTEM = `Eres el asistente de una agenda personal en español. Conviertes lo que escribe la usuaria en tareas para su calendario.
La semana empieza el lunes.

Categorías:
- ejercicio: pilates, gym, yoga, correr, natación…
- medico: médico, dentista, fisio, análisis, ginecóloga, cualquier cita sanitaria
- trabajo: trabajo, turno, curro, reunión, guardia
- estudio: clase, examen, estudiar, academia
- compras: compra, supermercado, recados de tienda
- casa: limpiar, lavadora, cocinar, plantas
- cuidado: agua, skincare, dormir, medicación, autocuidado
- social: planes, quedadas, cumpleaños, cenas, citas con amigos o pareja
- general: lo que no encaje en ninguna

Cómo rellenar cada tarea:
- "todos los días" → repeat "daily".
- Días de la semana que se repiten ("los lunes y miércoles", "de lunes a viernes") → repeat "weekly" con days (0=lunes … 6=domingo).
- Fechas concretas o rangos ("el 3, 4 y 10", "del 3 al 7", "este jueves y el siguiente") → repeat "dates" con todas las fechas YYYY-MM-DD ya expandidas. Si es una única fecha, repeat "once" con date.
- Si no dice el mes, es el mes actual, salvo que ese día ya haya pasado este mes: entonces es el mes siguiente. "Mañana", "pasado mañana", "el viernes", "la semana que viene" se calculan desde la fecha de hoy que te doy.
- Horas en formato 24 h: "a las 6 de la tarde" → "18:00"; "a las 9" sin más contexto → "09:00"; si no hay hora, "".
- title corto, con mayúscula inicial, sin la fecha ni la hora (por ejemplo "Pilates", "Turno de trabajo", "Cita con la dentista").
- Una tarea por actividad distinta. No inventes tareas que no aparezcan en el texto.
- Los campos que no aplican van vacíos: date "", days [], dates [].
- Si una parte no se entiende, sáltala y explícalo en note en una frase corta; si todo está claro, note "".`;

const client = new Anthropic(); // lee ANTHROPIC_API_KEY de los secretos

const okDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Revisa lo que devuelve el modelo antes de mandarlo a la app
function clean(raw: any) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, 40) : [];
  const out = [];
  for (const t of tasks) {
    const title = String(t?.title ?? "").trim().slice(0, 80);
    if (!title) continue;
    const cat = CATS.includes(t?.cat) ? t.cat : "general";
    const time = typeof t?.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time) ? t.time : "";
    const repeat = ["once", "daily", "weekly", "dates"].includes(t?.repeat) ? t.repeat : "once";
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

  // Solo usuarias con sesión iniciada pueden gastar el saldo de la API
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: u, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !u?.user) return json({ error: "login" }, 401);

  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "no_key" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const text = String(body?.text ?? "").trim().slice(0, 3000);
  const today = okDate(body?.today) ? body.today : new Date().toISOString().slice(0, 10);
  const weekday = Number.isInteger(body?.weekday) && body.weekday >= 0 && body.weekday <= 6 ? body.weekday : 0;
  if (!text) return json({ error: "empty" }, 400);

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: `Hoy es ${DAYS[weekday]} ${today}.\n\nTexto:\n${text}` }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      ...(SUPPORTS_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    } as any);

    if (response.stop_reason === "refusal") return json({ error: "refusal" }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "too_long" }, 422);
    const out = response.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    console.log("usage", JSON.stringify(response.usage));
    return json(clean(JSON.parse(out)));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "quota" }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "bad_key" }, 500);
    if (err instanceof Anthropic.BadRequestError) {
      // Sin saldo la API responde 400 con un mensaje de crédito
      console.error("bad request:", err.message);
      return json({ error: /credit|balance/i.test(err.message) ? "no_credit" : "claude" }, 502);
    }
    if (err instanceof Anthropic.APIError) { console.error(`API error ${err.status}:`, err.message); return json({ error: "claude" }, 502); }
    if (err instanceof SyntaxError) return json({ error: "parse" }, 502);
    console.error(err);
    return json({ error: "claude" }, 502);
  }
});
