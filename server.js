import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// --------------------------------------------------
// BODY
// --------------------------------------------------

app.use(
  express.json({
    limit: "100kb",
  })
);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    ai_configured: Boolean(client),
    service: "NEMAP.ai",
    model: MODEL,
  });
});

// --------------------------------------------------
// USER DATA CLEANING
// --------------------------------------------------

function cleanUser(user = {}) {
  return {
    name: String(user.name || "").trim().slice(0, 100),

    time: Number(user.time || 0),

    customers: Number(user.customers || 0),

    distributors: Number(user.distributors || 0),

    problem: String(user.problem || "")
      .trim()
      .slice(0, 300),

    goalCustomer: Number(user.goalCustomer || 0),

    goalDistributor: Number(user.goalDistributor || 0),

    goalIncome: Number(user.goalIncome || 0),
  };
}

// --------------------------------------------------
// AI SYSTEM PROMPT
// --------------------------------------------------

const systemPrompt = `
Sen NEMAP.ai platformunun AI iş koçusun.

NEMAP.ai, network marketing yapan kişilerin işlerini sistemli hale
getirmesine yardımcı olan bir AI koçluk platformudur.

Görevin kullanıcıya gerçekçi, ölçülebilir, uygulanabilir ve etik
bir 30 günlük iş stratejisi oluşturmaktır.

Kullanıcının verdiği:

- çalışma süresini
- mevcut müşteri sayısını
- mevcut distribütör / ekip üyesi sayısını
- en büyük problemini
- müşteri hedefini
- distribütör hedefini
- gelir hedefini

birlikte değerlendir.

Önceliğin kullanıcının hedeflerine ulaşmasını sağlayacak en yüksek
etkili faaliyetleri belirlemektir.

Özellikle:

1. Yeni insan bulma
2. Davet
3. Takip
4. Görüşme
5. Sunum
6. İçerik üretimi
7. Eğitim
8. Disiplin
9. Ekip yönetimi

arasındaki bağlantıyı değerlendir.

Kullanıcıya gerçekçi olmayan gelir veya sonuç garantileri verme.

Sahte kıtlık, manipülasyon, baskı, spam, yanıltıcı kazanç iddiaları
ve etik olmayan network marketing yöntemleri önerme.

Kullanıcının çalışma süresine göre görev hacmini ayarla.

Örneğin kullanıcı günde 2 saat ayırabiliyorsa 8 saatlik plan verme.

Hedef ile günlük faaliyet arasında matematiksel tutarlılık kur.

Büyük hedefi günlük ve haftalık faaliyetlere dönüştür.

Kullanıcının en büyük problemini doğrudan ele al.

BUGÜNÜN GÖREVLERİ özellikle uygulanabilir olmalıdır.

Her görev için mümkün olduğunca:

- ne yapılacağı
- neden şimdi yapılması gerektiği
- tahmini süre
- beklenen sonuç

belirtilmelidir.

Yanıtını SADECE geçerli JSON olarak üret.

Markdown kullanma.

JSON dışında hiçbir açıklama yazma.

JSON şu yapıda olmalıdır:

{
  "score": 0,
  "summary": "Kısa genel değerlendirme",
  "strengths": [
    "Güçlü yön 1",
    "Güçlü yön 2"
  ],
  "risks": [
    "Risk 1",
    "Risk 2"
  ],
  "priority_actions": [
    "Öncelikli aksiyon 1",
    "Öncelikli aksiyon 2",
    "Öncelikli aksiyon 3"
  ],
  "daily_activity": {
    "new_contacts": 0,
    "follow_ups": 0
  },
  "thirty_day_plan": [
    {
      "week": 1,
      "focus": "Hafta odağı",
      "actions": [
        "Aksiyon 1",
        "Aksiyon 2"
      ]
    },
    {
      "week": 2,
      "focus": "Hafta odağı",
      "actions": [
        "Aksiyon 1",
        "Aksiyon 2"
      ]
    },
    {
      "week": 3,
      "focus": "Hafta odağı",
      "actions": [
        "Aksiyon 1",
        "Aksiyon 2"
      ]
    },
    {
      "week": 4,
      "focus": "Hafta odağı",
      "actions": [
        "Aksiyon 1",
        "Aksiyon 2"
      ]
    }
  ],
  "today_tasks": [
    {
      "title": "Görev başlığı",
      "why_now": "Bu görevin neden önemli olduğu",
      "minutes": 30
    },
    {
      "title": "Görev başlığı",
      "why_now": "Bu görevin neden önemli olduğu",
      "minutes": 30
    },
    {
      "title": "Görev başlığı",
      "why_now": "Bu görevin neden önemli olduğu",
      "minutes": 30
    }
  ]
}

score 0 ile 100 arasında olmalıdır.

daily_activity.new_contacts ve follow_ups sayı olmalıdır.

today_tasks tam olarak 3 görev içermelidir.

Görev süreleri kullanıcının günlük çalışma süresini aşmayacak şekilde
planlanmalıdır.
`;

// --------------------------------------------------
// AI ANALYZE
// --------------------------------------------------

app.post("/api/ai/analyze", async (req, res) => {
  try {
    // API KEY kontrolü
    if (!client) {
      return res.status(503).json({
        error: "AI servisi yapılandırılmamış.",
        details:
          "OPENAI_API_KEY Render ortam değişkenlerinde bulunamadı.",
      });
    }

    // Body kontrolü
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Geçersiz istek.",
        details: "Request body bulunamadı.",
      });
    }

    // User kontrolü
    if (!req.body.user || typeof req.body.user !== "object") {
      return res.status(400).json({
        error: "Kullanıcı bilgileri bulunamadı.",
        details: "user alanı zorunludur.",
      });
    }

    const user = cleanUser(req.body.user);

    // İsim kontrolü
    if (!user.name) {
      return res.status(400).json({
        error: "Kullanıcı adı gerekli.",
        details: "name alanı boş bırakılamaz.",
      });
    }

    // --------------------------------------------------
    // AI INPUT
    // --------------------------------------------------

    const input = `
NEMAP.ai kullanıcı verileri:

Ad:
${user.name}

Günlük çalışma süresi:
${user.time} saat

Mevcut müşteri:
${user.customers}

Mevcut distribütör / ekip üyesi:
${user.distributors}

En büyük problem:
${user.problem}

30 günlük yeni müşteri hedefi:
${user.goalCustomer}

30 günlük yeni distribütör hedefi:
${user.goalDistributor}

30 günlük gelir hedefi:
${user.goalIncome} TL

Bu kullanıcı için NEMAP.ai başlangıç iş analizini oluştur.

Yanıtını yalnızca geçerli JSON olarak ver.
JSON dışında hiçbir metin yazma.
`;

    console.log("NEMAP AI request başladı.");
    console.log("Model:", MODEL);
    console.log("User:", user.name);

    // --------------------------------------------------
    // OPENAI RESPONSES API
    // --------------------------------------------------

    const response = await client.responses.create({
      model: MODEL,
      instructions: systemPrompt,
      input: input,
    });

    // --------------------------------------------------
    // RESPONSE TEXT
    // --------------------------------------------------

    const outputText = response?.output_text;

    if (!outputText) {
      console.error("OpenAI boş cevap döndürdü.");

      return res.status(502).json({
        error: "AI boş yanıt döndürdü.",
        details: "OpenAI response.output_text bulunamadı.",
      });
    }

    console.log("NEMAP AI response alındı.");

    // --------------------------------------------------
    // JSON TEMİZLEME
    // --------------------------------------------------

    let cleanedText = outputText.trim();

    // Eğer model yanlışlıkla ```json ... ``` döndürürse temizle
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    // --------------------------------------------------
    // JSON PARSE
    // --------------------------------------------------

    let result;

    try {
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("AI JSON parse hatası:");
      console.error(cleanedText);

      return res.status(502).json({
        error: "AI geçerli JSON döndürmedi.",
        details: parseError?.message || "JSON parse hatası.",
        raw_output: cleanedText.slice(0, 2000),
      });
    }

    // --------------------------------------------------
    // BASIC RESULT VALIDATION
    // --------------------------------------------------

    if (typeof result !== "object" || result === null) {
      return res.status(502).json({
        error: "AI yanıt formatı geçersiz.",
        details: "AI nesne yerine farklı bir veri döndürdü.",
      });
    }

    // Score güvenliği
    if (typeof result.score !== "number") {
      result.score = 50;
    }

    result.score = Math.max(
      0,
      Math.min(100, Math.round(result.score))
    );

    // daily_activity güvenliği
    if (
      !result.daily_activity ||
      typeof result.daily_activity !== "object"
    ) {
      result.daily_activity = {};
    }

    if (
      typeof result.daily_activity.new_contacts !== "number"
    ) {
      result.daily_activity.new_contacts = 0;
    }

    if (
      typeof result.daily_activity.follow_ups !== "number"
    ) {
      result.daily_activity.follow_ups = 0;
    }

    // today_tasks güvenliği
    if (!Array.isArray(result.today_tasks)) {
      result.today_tasks = [];
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    console.log("NEMAP AI analysis başarıyla tamamlandı.");

    return res.status(200).json(result);
  } catch (error) {
    console.error("NEMAP AI error:");

    console.error(error);

    // OpenAI hata bilgisi
    const status = error?.status || error?.statusCode;

    const message =
      error?.message ||
      error?.error?.message ||
      "Bilinmeyen sunucu hatası.";

    console.error("Status:", status);
    console.error("Message:", message);

    return res.status(502).json({
      error: "AI analizi sırasında hata oluştu.",
      details: message,
      status: status || 502,
    });
  }
});

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint bulunamadı.",
    path: req.originalUrl,
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Global server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Sunucu hatası.",
    details: error?.message || "Bilinmeyen hata.",
  });
});

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("NEMAP.ai backend çalışıyor");
  console.log("Port:", PORT);
  console.log("Model:", MODEL);
  console.log("AI configured:", Boolean(client));
  console.log("======================================");
});
