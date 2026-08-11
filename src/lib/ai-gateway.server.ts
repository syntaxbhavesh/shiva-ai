import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Groq through its OpenAI-compatible endpoint.
 * The API key stays server-side and must be supplied through
 * GROQ_API_KEY in the deployment environment.
 */
export function createGroqProvider(groqApiKey: string) {
  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: groqApiKey,
  });
}
