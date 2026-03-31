import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
  ],
  cliFlag: "--gemini",
  llmService: "gemini",
  requiresEnvVar: { key: "GEMINI_API_KEY", description: "Gemini API" },
})
