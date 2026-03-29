import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

const ANTHROPIC_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const

for (const model of ANTHROPIC_MODELS) {
  defineLLMWriteTest({
    model,
    cliFlag: "--anthropic",
    llmService: "anthropic",
    requiresEnvVar: { key: "ANTHROPIC_API_KEY", description: "Anthropic Claude models" },
  })
}
