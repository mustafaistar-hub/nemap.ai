import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "100kb" }));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const systemPrompt = `
Sen NEMAP.ai'nin Network Marketing AI Coach'usun.
Görevin, kullanıcının verdiği iş verilerini analiz ederek gerçekçi, ölçülebilir ve uygulanabilir bir 30 günlük başlangıç stratejisi oluşturmaktır.

Kurallar:
- Kullanıcıyı motive et ama boş vaat verme.
- Gelir veya başarı garantisi verme.
- Etik network marketing yaklaşımı kullan; yanıltıcı kıtlık, sahte sonuç, baskıcı satış veya spam önerme.
- Hedefleri mevcut durum, ayrılan süre ve hedeflerle ilişkilendir.
- Günlük görevleri önceliklendir; az sayıda ama yüksek etkili görev üret.
- Kullanıcının en büyük problemini doğrudan plana dahil et.
- Sayısal hedeflerde matematiksel olarak tutarlı ol.
-Yanıtını yalnızca geçerli JSON formatında ver. JSON dışında açıklama veya metin ekleme.

JSON şeması:
{
  "score": number,
  "summary": string,
  "strengths": string[],
  "risks": string[],
  "priority_actions": string[],
  "daily_activity": {"new_contacts": number, "follow_ups": number},
  "thirty_day_plan": [{"week": number, "focus": string, "actions": string[]}],
  "today_tasks": [{"title": string, "why_now": string, "minutes": number}]
}
`;

function cleanUser(user) {
  if (!user || typeof user !== "object") return null;
  return {
    name: String(user.name || "").slice(0, 80),
    time: Number(user.time || 0),
    customers: Number(user.customers || 0),
    distributors: Number(user.distributors || 0),
    problem: String(user.problem || "").slice(0, 120),
    goalCustomer: Number(user.goalCustomer || 0),
    goalDistributor: Number(user.goalDistributor || 0),
    goalIncome: Number(user.goalIncome || 0)
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai_configured: Boolean(client), service: "NEMAP.ai" });
});

app.post("/api/ai/analyze", async (req, res) => {
  const user = cleanUser(req.body?.user);
  if (!user) return res.status(400).json({ error: "Kullanıcı verisi bulunamadı." });
  if (!client) return res.status(503).json({ error: "OPENAI_API_KEY yapılandırılmamış." });

  const input = `Kullanıcı verileri:\n${JSON.stringify(user, null, 2)}\n\nBu kullanıcı için ilk NEMAP.ai iş analizini ve bugünün 3 öncelikli görevini oluştur.`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.1",
      instructions: systemPrompt,
      input: `Aşağıdaki kullanıcı verilerini analiz et. Yanıtını geçerli JSON formatında üret:\n${input}`,
      text: { format: { type: "json_object" } }
    });

    let data;
    try {
      data = JSON.parse(response.output_text);
    } catch {
      return res.status(502).json({ error: "AI geçerli JSON döndürmedi." });
    }

    return res.json(data);
  } catch (error) {
    console.error("NEMAP AI error:", error);
    return res.status(502).json({ error: "AI analizi sırasında hata oluştu.", details: error?.message || "Bilinmeyen hata" });
  }
});

app.listen(port, () => {
  console.log(`NEMAP.ai backend running on http://localhost:${port}`);
});
