# NEMAP.ai Backend MVP

Bu servis, NEMAP.ai web arayüzündeki `/api/ai/analyze` çağrısını OpenAI Responses API'ye bağlar.

## Kurulum

1. Node.js kurulu olmalı.
2. Bu klasörde terminal aç:
   `npm install`
3. `.env.example` dosyasını `.env` olarak kopyala.
4. `.env` içine kendi OpenAI API anahtarını yaz:
   `OPENAI_API_KEY=...`
5. Çalıştır:
   `npm start`
6. Kontrol:
   `http://localhost:3000/api/health`

## Önemli

API anahtarını HTML/JavaScript içine koyma. Anahtar yalnızca sunucunun `.env` ortamında tutulmalıdır.

NEMAP frontend şu endpoint'i kullanıyor:
`POST /api/ai/analyze`

Gönderilen gövde:
`{ "user": { ...onboarding verileri... } }`
