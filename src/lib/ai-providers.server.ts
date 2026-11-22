import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ShivaProvider = { name: string; model: ReturnType<ReturnType<typeof createOpenAICompatible>> };

export function getShivaProviders(): ShivaProvider[] {
  const providers: ShivaProvider[] = [];
  const groqKey = process.env["GROQ_API_KEY"]?.trim();
  const geminiKey = process.env["GEMINI_API_KEY"]?.trim();
  const cloudflareToken = process.env["CLOUDFLARE_API_TOKEN"]?.trim();
  const cloudflareAccount = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();

  if (groqKey) {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
    });
    providers.push({ name: "Groq", model: groq("openai/gpt-oss-120b") });
  }

  if (geminiKey) {
    const gemini = createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: geminiKey,
    });
    providers.push({
      name: "Gemini",
      model: gemini(process.env["GEMINI_MODEL"]?.trim() || "gemini-2.5-flash"),
    });
  }

  if (cloudflareToken && cloudflareAccount) {
    const cloudflare = createOpenAICompatible({
      name: "cloudflare",
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount}/ai/v1`,
      apiKey: cloudflareToken,
    });
    providers.push({
      name: "Cloudflare",
      model: cloudflare(
        process.env["CLOUDFLARE_MODEL"]?.trim() ||
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      ),
    });
  }

  return providers;
}
