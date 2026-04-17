import { describe, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  stopLlamaServer,
} from "../../../../../test-utils/test-helpers"
import { budgetedTest } from '../../../../../test-utils/budget'
import { readRunMetadata } from "../../../../../test-utils/manifest-helpers"

describe("llama qwen", () => {
  beforeAll(async () => {
    await stopLlamaServer()
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  const model = "ggml-org/Qwen3-0.6B-GGUF"
  const llamaTestName = `${model} generates summary`

  budgetedTest('write-llama-qwen3-0.6b', llamaTestName, async () => {
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
  })
})
