import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

defineLLMWriteTest({
  models: [
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
  ],
  cliFlag: "--minimax",
  llmService: "minimax",
  requiresEnvVar: { key: "MINIMAX_API_KEY", description: "MiniMax models" },
})
