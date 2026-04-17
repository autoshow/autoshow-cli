import { describe, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  stopLlamaServer,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../test-utils/budget'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'


describe('write subcommand with llama', () => {
  beforeAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  })

  budgetedTest('write-llama-qwen3-0.6b', 'write input/examples/audio/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF', async () => {
    await stopLlamaServer()

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', 'ggml-org/Qwen3-0.6B-GGUF'],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const summaryJson = await Bun.file(`${outputDir}/text.json`).json() as unknown
      expect(summaryJson).toBeDefined()

      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.step3?.llmModel).toBe('ggml-org/Qwen3-0.6B-GGUF')
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  })

  budgetedTest('write-llama-qwen3-0.6b', 'write input/examples/audio/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF --prompt shortSummary longSummary', async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--prompt', 'shortSummary', 'longSummary'],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.step3?.llmModel).toBe('ggml-org/Qwen3-0.6B-GGUF')
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  })
})

describe('write subcommand with document input', () => {
  const documentTitleSuffix = '1-document'

  const cleanupDocOutput = async () => {
    if (process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] !== '0') return
    const result = await Bun.$`find ./output -maxdepth 1 -type d -name "*_${documentTitleSuffix}" 2>/dev/null`.quiet().nothrow()
    const dirs = result.stdout.toString().trim().split('\n').filter(Boolean)
    await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })))
  }

  beforeAll(async () => {
    await stopLlamaServer()
    await cleanupDocOutput()
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupDocOutput()
  })

  budgetedTest('write-llama-qwen3-0.6b-document', 'write input/examples/document/1-document.pdf --llama ggml-org/Qwen3-0.6B-GGUF', async () => {
    await stopLlamaServer()
    await cleanupDocOutput()

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', 'input/examples/document/1-document.pdf', '--llama', 'ggml-org/Qwen3-0.6B-GGUF'],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = await findLatestDirectory(documentTitleSuffix)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.step3?.llmModel).toBe('ggml-org/Qwen3-0.6B-GGUF')
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  })
})
