import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
// BODY PARSER
// --------------------------------------------------

app.use(express.json({ limit: "100kb" }));

// --------------------------------------------------
// OPENAI
// --------------------------------------------------

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

// --------------------------------------------------
// AI SYSTEM PROMPT
// --------------------------------------------------

const systemPrompt = `
Sen NEMAP.ai isimli network marketing platformunun AI iş koçusun.

Görevin network marketing yapan kişinin mevcut durumunu analiz etmek,
hedeflerini gerçekçi şekilde planlamak ve uygulanabilir bir 30 günlük
iş sistemi oluşturmaktır.

Kullanıcının:
- çalışma süresini
- mevcut müşteri sayısını
- distribütör / ekip sayısını
- en büyük problemini
- yeni müşteri hedefini
- yeni distribütör hedefini
- gelir hedefini

birlikte değerlendir.

Önceliklerin:

1. Hedeflerin gerçekçi olup olmadığını değerlendir.
2. Kullanıcının mevcut durumuyla hedefleri arasındaki farkı belirle.
3. En büyük darboğazı tespit et.
4. En yüksek etkili günlük aktiviteleri belirle.
5. Yeni insanlarla temas, takip, davet, içerik ve eğitim gibi aktiviteleri
   dengeli şekilde planla.
6. Kullanıcının ayırabileceği zamana göre görevleri gerçekçi tut.
7. Günlük görevleri önem sırasına göre belirle.
8. 30 günlük uygulanabilir bir plan oluştur.
9. Riskleri açıkça belirt.
10. Kullanıcıya uygulanabilir ve ölçülebilir öneriler ver.

Network marketing iletişimi etik olmalıdır.

Şunları önermemelisin:
- spam
- baskı
- manipülasyon
- sahte kıtlık
- sahte sonuçlar
- gerçek dışı gelir garantileri
- yanıltıcı sağlık veya finansal vaatler

Kullanıcının hedeflerini küçümseme ancak gerçekçi olmayan hedefleri
açıkça belirt.

Özellikle kullanıcının belirttiği en büyük problem alanına odaklan.

Örneğin kullanıcı içerik üretmekte zorlanıyorsa içerik üretimini,
yeni insan bulmakta zorlanıyorsa yeni temas üretimini,
takip yapmakta zorlanıyorsa CRM ve takip sistemini önceliklendir.

Çıktını geçerli JSON olarak üret.

JSON dışında açıklama yazma.

Yanıtın mutlaka "json" formatında olmalıdır.
`;

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
      .slice(0, 200),

    goalCustomer: Number(user.goalCustomer || 0),

    goalDistributor: Number(user.goalDistributor || 0),

    goalIncome: Number(user.goalIncome || 0),
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    ai_configured: Boolean(client),
    service: "NEMAP.ai",
  });
});

// --------------------------------------------------
// AI ANALYSIS
// --------------------------------------------------

app.post("/api/ai/analyze", async (req, res) => {
  try {
    // OpenAI API anahtarı kontrolü
    if (!client) {
      return res.status(503).json({
        error: "OpenAI API anahtarı bulunamadı.",
        details:
          "Render Environment Variables bölümünde OPENAI_API_KEY tanımlı olmalı.",
      });
    }

    // Kullanıcı verisi
    const user = cleanUser(req.body?.user);

    // Basit doğrulama
    if (!user.name) {
      return res.status(400).json({
        error: "Kullanıcı adı gerekli.",
      });
    }

    // Modele gönderilecek veri
    const input = `
Bu kullanıcı verilerini analiz et ve geçerli JSON üret.

Kullanıcı bilgileri:

Ad:
${user.name}

Günlük çalışma süresi:
${user.time} saat

Mevcut aktif müşteri:
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

Kullanıcının mevcut durumu ile hedeflerini karşılaştır.

Günlük uygulanabilir aktiviteleri belirle.

Özellikle yeni temas, takip, içerik, davet ve gelişim aktivitelerini
kullanıcının çalışma süresine göre planla.

Sonucu yalnızca JSON olarak döndür.
`;

    // --------------------------------------------------
    // OPENAI REQUEST
    // --------------------------------------------------

    const response = await client.responses.create({
      model: MODEL,

      instructions: systemPrompt,

      input: input,

      text: {
        format: {
          type: "json_object",
        },
      },
    });

    // --------------------------------------------------
    // RESPONSE PARSE
    // --------------------------------------------------

    const outputText = response.output_text;

    if (!outputText) {
      throw new Error("OpenAI boş yanıt döndürdü.");
    }

    let result;

    try {
      result = JSON.parse(outputText);
    } catch (parseError) {
      console.error("JSON parse hatası:", parseError);
      console.error("OpenAI çıktısı:", outputText);

      return res.status(502).json({
        error: "AI geçerli JSON üretmedi.",
        details: outputText,
      });
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.json(result);
  } catch (error) {
    console.error("NEMAP AI error:", error);

    return res.status(502).json({
      error: "AI analizi sırasında hata oluştu.",
      details: error?.message || "Bilinmeyen hata",
    });
  }
});

// --------------------------------------------------
// UNKNOWN ROUTE
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint bulunamadı.",
    path: req.path,
  });
});

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NEMAP.ai backend running on port ${PORT}`);
});
