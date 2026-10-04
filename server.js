import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// CORS: browser clients such as the NEMAP site preview may call this API.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  res.header("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "100kb" }));

const systemPrompt = `
You are NEMAP.ai, an ethical AI business coach for network marketers.
Analyze the user's current situation and create a realistic, measurable, practical first strategy and 30-day plan.
Rules: be direct and specific; connect time, current numbers and goals; prioritize high-impact actions; address the biggest difficulty; keep calculations consistent; never promise guaranteed income/customers/results; never recommend spam, fake scarcity, manipulation, deception or pressure; recommend ethical relationship-based communication; give actions that can actually be completed daily.
Return ONLY valid JSON, with no markdown or code fences.
Return exactly these top-level fields:
{"score":number,"summary":string,"strengths":string[],"risks":string[],"priority_actions":string[],"daily_activity":{"new_contacts":number,"follow_ups":number},"thirty_day_plan":[{"week":number,"focus":string,"actions":string[],"target":string}],"today_tasks":[{"title":string,"why_now":string,"minutes":number,"result_expected":string}]}
Score is 0-100. thirty_day_plan must contain exactly 4 weekly objects. today_tasks must contain 3 high-priority tasks.
`;

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 1000) : fallback;
}
function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(n, 1000000000)) : fallback;
}
function cleanUser(user = {}) {
  return {
    name: cleanString(user.name, "Kullanıcı"),
    time: cleanNumber(user.time, 4),
    customers: cleanNumber(user.customers),
    distributors: cleanNumber(user.distributors),
    problem: cleanString(user.problem, "Yeni insan bulmak"),
    goalCustomer: cleanNumber(user.goalCustomer),
    goalDistributor: cleanNumber(user.goalDistributor),
    goalIncome: cleanNumber(user.goalIncome)
  };
}
function parseJsonOutput(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}
function validateResult(result) {
  if (!result || typeof result !== "object") throw new Error("AI geçerli bir JSON nesnesi döndürmedi.");
  if (!Number.isFinite(Number(result.score))) throw new Error("AI yanıtında score alanı eksik.");
  if (!result.daily_activity || typeof result.daily_activity !== "object") throw new Error("AI yanıtında daily_activity alanı eksik.");
  if (!Array.isArray(result.today_tasks)) throw new Error("AI yanıtında today_tasks alanı eksik.");
  return result;
}

app.get("/", (_req, res) => res.json({ ok: true, service: "NEMAP.ai", message: "NEMAP.ai backend çalışıyor." }));
app.get("/api/health", (_req, res) => res.json({ ok: true, ai_configured: Boolean(client), service: "NEMAP.ai", model: MODEL }));

app.post("/api/ai/analyze", async (req, res) => {
  try {
    if (!client) return res.status(503).json({ error: "AI yapılandırılmamış.", details: "OPENAI_API_KEY Render Environment Variables içinde bulunamadı." });
    if (!req.body || typeof req.body !== "object") return res.status(400).json({ error: "Geçersiz istek gövdesi.", details: "JSON body gönderilmelidir." });

    const user = cleanUser(req.body.user);
    const input = `NEMAP kullanıcı verileri:\nAd: ${user.name}\nGünlük net süre: ${user.time} saat\nAktif müşteri: ${user.customers}\nDistribütör/ekip: ${user.distributors}\nEn çok zorlandığı konu: ${user.problem}\n30 günlük yeni müşteri hedefi: ${user.goalCustomer}\n30 günlük yeni distribütör hedefi: ${user.goalDistributor}\n30 günlük gelir hedefi: ${user.goalIncome} TL\nBu verileri analiz et ve istenen JSON yapısında NEMAP ilk raporunu oluştur.`;

    const response = await client.responses.create({ model: MODEL, instructions: systemPrompt, input });
    return res.json(validateResult(parseJsonOutput(response.output_text)));
  } catch (error) {
    console.error("NEMAP AI error:", error);
    return res.status(502).json({ error: "AI analizi sırasında hata oluştu.", details: error?.message || "Bilinmeyen hata", model: MODEL });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Endpoint bulunamadı." }));
app.use((error, _req, res, _next) => res.status(500).json({ error: "Sunucu hatası.", details: error?.message || "Bilinmeyen hata" }));

app.listen(PORT, "0.0.0.0", () => console.log(`NEMAP.ai backend running on port ${PORT}; model=${MODEL}`));
