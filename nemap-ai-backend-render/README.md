# NEMAP.ai Backend — Render

Render:
- Build Command: npm install
- Start Command: npm start

Environment Variables:
- OPENAI_API_KEY = OpenAI API key
- OPENAI_MODEL = gpt-6-luna
- PORT = leave unset; Render supplies PORT

Test after deploy:
https://nemap-ai-backend.onrender.com/api/health

Expected:
{"ok":true,"ai_configured":true,"service":"NEMAP.ai","model":"gpt-6-luna"}

The AI endpoint is POST /api/ai/analyze. This version uses the OpenAI Responses API and does not use the old text.format json_object option that caused the previous 400 error.
