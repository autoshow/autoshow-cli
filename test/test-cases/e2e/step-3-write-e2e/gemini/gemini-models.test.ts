import { defineLLMWriteTest } from "../../../../test-utils/define-llm-write-test"

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
] as const

for (const model of GEMINI_MODELS) {
  defineLLMWriteTest({
    model,
    cliFlag: "--gemini",
    llmService: "gemini",
    requiresEnvVar: { key: "GEMINI_API_KEY", description: "Gemini API" },
  })
}
