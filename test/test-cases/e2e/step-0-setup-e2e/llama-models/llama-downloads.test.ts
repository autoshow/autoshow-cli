import { describe, test, expect, beforeAll } from "bun:test"
import { runCommand, stopLlamaServer } from "../../../../test-utils/test-helpers"


const LLAMA_MODELS = [
  "ggml-org/gemma-3-270m-it-GGUF",
  "ggml-org/Qwen3-0.6B-GGUF",
]

describe("llama model downloads", () => {
  beforeAll(async () => {
    await stopLlamaServer()
  })

  for (const model of LLAMA_MODELS) {
    const downloadTestName = `${model} downloads successfully`
    test(downloadTestName, async () => {
      await stopLlamaServer()

      const result = await runCommand(
        ["src/cli/create-cli.ts", "models", model],
        { testName: downloadTestName },
      )

      expect(result.exitCode).toBe(0)
    })
  }
})
