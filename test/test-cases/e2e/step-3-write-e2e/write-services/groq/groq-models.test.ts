import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

const GROQ_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
] as const

for (const model of GROQ_MODELS) {
  defineLLMWriteTest({
    model,
    cliFlag: "--groq",
    llmService: "groq",
    requiresEnvVar: { key: "GROQ_API_KEY", description: "Groq models" },
  })
}
