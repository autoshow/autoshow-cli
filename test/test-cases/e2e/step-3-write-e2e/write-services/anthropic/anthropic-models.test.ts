import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
  ],
  cliFlag: "--anthropic",
  llmService: "anthropic",
  requiresEnvVar: { key: "ANTHROPIC_API_KEY", description: "Anthropic Claude models" },
})
