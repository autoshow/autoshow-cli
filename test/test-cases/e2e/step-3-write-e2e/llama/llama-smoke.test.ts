import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  stopLlamaServer,
} from "../../../../test-utils/test-helpers"


describe("llama smoke", () => {
  beforeAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  test("ggml-org/gemma-3-270m-it-GGUF --price succeeds", async () => {
    const model = "ggml-org/gemma-3-270m-it-GGUF"
    await stopLlamaServer()

    const result = await runCommand(
      ["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, "--llama", model, "--price"],
    )

    expect(result.exitCode).toBe(0)
  })
})
