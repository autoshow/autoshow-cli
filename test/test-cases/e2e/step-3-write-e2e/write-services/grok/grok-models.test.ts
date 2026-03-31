import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "grok-4.20-reasoning",
    "grok-4.20-non-reasoning",
  ],
  cliFlag: "--grok",
  llmService: "grok",
  requiresEnvVar: { key: "XAI_API_KEY", description: "Grok models" },
})
