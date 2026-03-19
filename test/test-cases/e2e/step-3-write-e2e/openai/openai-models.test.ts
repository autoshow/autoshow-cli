import { defineLLMWriteTest } from "../../../../test-utils/define-llm-write-test"

const OPENAI_MODELS = [
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5.1",
] as const

for (const model of OPENAI_MODELS) {
  defineLLMWriteTest({ model, cliFlag: "--openai", llmService: "openai" })
}
