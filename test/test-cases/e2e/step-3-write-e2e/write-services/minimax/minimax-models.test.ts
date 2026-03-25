import { defineLLMWriteTest } from "../../../../../test-utils/define-llm-write-test"

const MINIMAX_MODELS = [
  "MiniMax-M2.5",
  "MiniMax-M2.5-highspeed",
] as const

for (const model of MINIMAX_MODELS) {
  defineLLMWriteTest({
    model,
    cliFlag: "--minimax",
    llmService: "minimax",
    requiresEnvVar: { key: "MINIMAX_API_KEY", description: "MiniMax models" },
  })
}
