/**
 * The AI-translation provider catalog - single backend source of truth for
 * which providers the router accepts and how each one is reached.
 *
 * Three transports cover everything:
 * - `gemini`: Google's native generateContent API.
 * - `anthropic`: Anthropic's native Messages API (Claude).
 * - `openai`: the OpenAI-compatible chat-completions surface that nearly every
 *   LLM vendor exposes (OpenAI, Groq, OpenRouter, Mistral, DeepSeek, Together,
 *   xAI, self-hosted Ollama/vLLM, ...). One client, many vendors.
 *
 * `custom` has no baseUrl here - the admin supplies one (Settings >
 * Integrations), which is what makes ANY OpenAI-compatible endpoint usable
 * without a code change. The dashboard mirrors this list in its PROVIDERS
 * constant (integrations-form.tsx) - keep the two in sync.
 */

export interface ProviderCatalogEntry {
  key: string;
  transport: 'gemini' | 'anthropic' | 'openai';
  /** Fixed API origin; absent = the admin must supply translationBaseUrl. */
  baseUrl?: string;
  /** Used when the admin leaves the model blank; absent = model is required. */
  defaultModel?: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    key: 'gemini',
    transport: 'gemini',
    // NOT a 2.5-family model: Google retired those for NEW accounts
    // ("no longer available to new users", verified 2026-07-27) - a fresh
    // AI Studio key can only call 3.x models.
    defaultModel: 'gemini-3.6-flash',
  },
  {
    key: 'anthropic',
    transport: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  {
    key: 'openai',
    transport: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    // "Faster, more efficient model for high-volume workloads" - the current
    // cheap workhorse (docs-verified 2026-07-27).
    defaultModel: 'gpt-5.4-mini',
  },
  {
    key: 'groq',
    transport: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    key: 'openrouter',
    transport: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Auto-router over whatever free models are CURRENTLY live - immune to
    // model retirements by construction (docs-verified 2026-07-27).
    defaultModel: 'openrouter/free',
  },
  {
    key: 'mistral',
    transport: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
  },
  {
    key: 'deepseek',
    transport: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  {
    key: 'custom',
    transport: 'openai',
    // No baseUrl and no defaultModel: both come from the admin.
  },
];

export const PROVIDER_KEYS = PROVIDER_CATALOG.map((p) => p.key);

export function catalogEntry(key: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key);
}
