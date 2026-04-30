import { describe, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  stopLlamaServer,
} from "../../../../../test-utils/test-helpers"
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from "../../../../../test-utils/budget"

describe("llama models", () => {
  beforeAll(async () => {
    await stopLlamaServer()
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  budgetedTest('write-llama-gemma-3-270m', 'ggml-org/gemma-3-270m-it-GGUF --price prints a llama cost estimate', async () => {
    const model = 'ggml-org/gemma-3-270m-it-GGUF'

    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', model, '--price'],
      { testName: `${model} --price prints a llama cost estimate` },
    )
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(output).toContain('Cost Estimate')
    expect(output).toContain('llm')
    expect(output).toContain('llama')
    expect(output).toContain(model)
  }, E2E_TEST_TIMEOUT_MS)
})
