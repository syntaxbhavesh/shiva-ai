# Answer Bot

make the AI respone to the queries of the user/student

## AI chat configuration

Set at least one server-side provider key in your Vercel project (**Settings → Environment Variables**) and redeploy:

- `GROQ_API_KEY` — preferred provider; Shiva AI uses Groq's `llama-3.3-70b-versatile` model.
- `LOVABLE_API_KEY` — fallback provider if Groq is not configured.

Do not put either key in client-side code or commit real keys. Local development: copy `.env.example` to `.env` and add your key.
