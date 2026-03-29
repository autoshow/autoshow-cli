import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

const GROK_MODELS = [
  "grok-4.20-reasoning",
  "grok-4.20-non-reasoning",
] as const

for (const model of GROK_MODELS) {
  defineLLMWriteTest({
    model,
    cliFlag: "--grok",
    llmService: "grok",
    requiresEnvVar: { key: "XAI_API_KEY", description: "Grok models" },
  })
}
