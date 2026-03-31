import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "gpt-5.4",
    "gpt-5.4-pro",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ],
  cliFlag: "--openai",
  llmService: "openai",
})
