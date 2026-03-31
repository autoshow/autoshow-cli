import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
  ],
  cliFlag: "--groq",
  llmService: "groq",
  requiresEnvVar: { key: "GROQ_API_KEY", description: "Groq models" },
})
