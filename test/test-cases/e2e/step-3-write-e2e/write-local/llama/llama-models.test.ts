import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  stopLlamaServer,
} from "../../../../../test-utils/test-helpers"
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from "../../../../../test-utils/budget"
import { readRunMetadata } from "../../../../../test-utils/manifest-helpers"


const LLAMA_MODELS = [
  "ggml-org/gemma-3-270m-it-GGUF",
]

describe("llama models", () => {
  beforeAll(async () => {
    await stopLlamaServer()
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  for (const model of LLAMA_MODELS) {
    const llamaTestName = `${model} generates summary`
    test(llamaTestName, async () => {
      await stopLlamaServer()
      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

      const result = await runCommand(
        ["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, "--llama", model],
        { testName: llamaTestName },
      )

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const summaryExists = await fileExists(`${outputDir}/text.json`)
        expect(summaryExists).toBe(true)

        const summaryJson = await Bun.file(`${outputDir}/text.json`).json() as unknown
        expect(summaryJson).toBeDefined()

        const metadataExists = await fileExists(`${outputDir}/run.json`)
        expect(metadataExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as {
          step3?: { llmModel?: string; llmService?: string }
        }
        expect(metadata.step3?.llmModel).toBe(model)
        expect(metadata.step3?.llmService).toBe("llama.cpp")
      }
    }, E2E_TEST_TIMEOUT_MS)
  }

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

  test('switches the running llama-server when a different model is requested', async () => {
    const firstModel = 'ggml-org/gemma-3-270m-it-GGUF'
    const secondModel = 'ggml-org/Qwen3-0.6B-GGUF'

    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

    const firstRun = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', firstModel],
      { testName: `${firstModel} primes llama-server` },
    )
    expect(firstRun.exitCode).toBe(0)

    const secondRun = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', secondModel],
      { testName: `${secondModel} replaces running llama-server` },
    )
    expect(secondRun.exitCode).toBe(0)

    const response = await fetch('http://127.0.0.1:8080/v1/models')
    expect(response.ok).toBe(true)

    const modelsPayload = await response.json() as {
      data?: Array<{ id?: string }>
    }
    const modelIds = modelsPayload.data?.map((entry) => entry.id).filter((value): value is string => typeof value === 'string') ?? []
    expect(modelIds).toContain(secondModel)

    const outputDir = secondRun.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.step3?.llmModel).toBe(secondModel)
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  }, E2E_TEST_TIMEOUT_MS)
})
