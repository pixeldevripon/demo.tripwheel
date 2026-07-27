-- Custom OpenAI-compatible endpoints: the admin can point AI translation at
-- ANY vendor exposing the chat-completions surface (Together, xAI, Ollama, ...).
ALTER TABLE "integrations_configuration"
  ADD COLUMN "translationBaseUrl" TEXT DEFAULT '';
