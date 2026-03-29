import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

const OPENAI_MODELS = [
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
] as const

for (const model of OPENAI_MODELS) {
  defineLLMWriteTest({ model, cliFlag: "--openai", llmService: "openai" })
}
