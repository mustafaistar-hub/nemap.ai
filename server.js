import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;


/* =========================
   CORS
========================= */

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


/* =========================
   BODY
========================= */

app.use(
  express.json({
    limit: "100kb"
  })
);


/* =========================
   AI SYSTEM PROMPT
========================= */

const systemPrompt = `
You are NEMAP.ai, an ethical AI business coach for network marketers.

Analyze the user's current situation and create a realistic, measurable and practical first strategy and 30-day plan.

Rules:

- Be direct and specific.
- Connect available time, current numbers and goals.
- Prioritize high-impact actions.
- Address the user's biggest difficulty.
- Keep calculations consistent.
- Never promise guaranteed income, customers or results.
- Never recommend spam.
- Never recommend fake scarcity.
- Never recommend manipulation, deception or pressure.
- Recommend ethical relationship-based communication.
- Give actions that can realistically be completed daily.

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.

Return exactly these top-level fields:

{
  "score": number,
  "summary": string,
  "strengths": string[],
  "risks": string[],
  "priority_actions": string[],
  "daily_activity": {
    "new_contacts": number,
    "follow_ups": number
  },
  "thirty_day_plan": [
    {
      "week": number,
      "focus": string,
      "actions": string[],
      "target": string
    }
  ],
  "today_tasks": [
    {
      "title": string,
      "why_now": string,
      "minutes": number,
      "result_expected": string
    }
  ]
}

Score must be between 0 and 100.

thirty_day_plan must contain exactly 4 weekly objects.

today_tasks must contain exactly 3 high-priority tasks.
`;


/* =========================
   HELPERS
========================= */

function cleanString(value, fallback = "") {
  return typeof value === "string"
    ? value.trim().slice(0, 1000)
    : fallback;
}


function cleanNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(number, 1000000000)
  );
}


function cleanUser(user = {}) {
  return {
    name: cleanString(user.name, "Kullanıcı"),

    time: cleanNumber(
      user.time,
      4
    ),

    customers: cleanNumber(
      user.customers
    ),

    distributors: cleanNumber(
      user.distributors
    ),

    problem: cleanString(
      user.problem,
      "Yeni insan bulmak"
    ),

    goalCustomer: cleanNumber(
      user.goalCustomer
    ),

    goalDistributor: cleanNumber(
      user.goalDistributor
    ),

    goalIncome: cleanNumber(
      user.goalIncome
    )
  };
}


function parseJsonOutput(raw) {
  let text = String(raw || "").trim();

  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first >= 0 && last > first) {
    text = text.slice(
      first,
      last + 1
    );
  }

  return JSON.parse(text);
}


function validateResult(result) {
  if (
    !result ||
    typeof result !== "object"
  ) {
    throw new Error(
      "AI geçerli bir JSON nesnesi döndürmedi."
    );
  }

  if (
    !Number.isFinite(
      Number(result.score)
    )
  ) {
    throw new Error(
      "AI yanıtında score alanı eksik."
    );
  }

  if (
    !result.daily_activity ||
    typeof result.daily_activity !== "object"
  ) {
    throw new Error(
      "AI yanıtında daily_activity alanı eksik."
    );
  }

  if (
    !Array.isArray(result.today_tasks)
  ) {
    throw new Error(
      "AI yanıtında today_tasks alanı eksik."
    );
  }

  if (
    !Array.isArray(result.thirty_day_plan)
  ) {
    throw new Error(
      "AI yanıtında thirty_day_plan alanı eksik."
    );
  }

  return result;
}


/* =========================
   BASIC ROUTES
========================= */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ai_configured: Boolean(client),
    service: "NEMAP.ai",
    model: MODEL
  });
});


app.get("/api/test", (_req, res) => {
  res.json({
    ok: true,
    message: "NEMAP.ai API çalışıyor."
  });
});


/* =========================
   AI ANALYSIS
========================= */

app.post(
  "/api/ai/analyze",
  async (req, res) => {
    try {

      if (!client) {
        return res.status(503).json({
          error: "AI yapılandırılmamış.",
          details:
            "OPENAI_API_KEY Render Environment Variables içinde bulunamadı."
        });
      }


      if (
        !req.body ||
        typeof req.body !== "object"
      ) {
        return res.status(400).json({
          error: "Geçersiz istek gövdesi.",
          details:
            "JSON body gönderilmelidir."
        });
      }


      const user = cleanUser(
        req.body.user
      );


      const input = `
NEMAP kullanıcı verileri:

Ad: ${user.name}

Günlük net çalışma süresi:
${user.time} saat

Aktif müşteri:
${user.customers}

Distribütör / ekip:
${user.distributors}

En çok zorlandığı konu:
${user.problem}

30 günlük yeni müşteri hedefi:
${user.goalCustomer}

30 günlük yeni distribütör hedefi:
${user.goalDistributor}

30 günlük gelir hedefi:
${user.goalIncome} TL

Bu verileri analiz et.

Kullanıcı için gerçekçi bir NEMAP ilk raporu oluştur.

İstenen JSON yapısına kesinlikle uy.
`;


      const response =
        await client.responses.create({
          model: MODEL,
          instructions: systemPrompt,
          input
        });


      const result =
        parseJsonOutput(
          response.output_text
        );


      const validated =
        validateResult(result);


      return res.json(
        validated
      );

    } catch (error) {

      console.error(
        "NEMAP AI error:",
        error
      );

      return res.status(502).json({
        error:
          "AI analizi sırasında hata oluştu.",
        details:
          error?.message ||
          "Bilinmeyen hata",
        model: MODEL
      });
    }
  }
);


/* =========================
   FRONTEND
========================= */

/*
  public/index.html varsa,
  Render artık NEMAP arayüzünü
  bu backend üzerinden yayınlar.
*/

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/*
  API olmayan tüm istekleri
  frontend'e yönlendir.
*/

app.use(
  (_req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);


/* =========================
   SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `NEMAP.ai backend running on port ${PORT}; model=${MODEL}`
    );
  }
);
