import { describe, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  stopLlamaServer,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from '../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import { readRunMetadata } from '../../../../test-utils/manifest-helpers'


describe('write subcommand with llama', () => {
  beforeAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  })

  afterAll(async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  })

  budgetedTest('write-llama-qwen3-0.6b', 'write https://ajc.pics/autoshow/examples/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF', async () => {
    await stopLlamaServer()

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_EXAMPLE_AUDIO_URL, '--llama', 'ggml-org/Qwen3-0.6B-GGUF'],
      {
        env: {
          AUTOSHOW_LOG_FORMAT: 'human',
          AUTOSHOW_LOG_LEVEL: 'info'
        }
      }
    )

    expect(result.exitCode).toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('Locations')
    expect(output).toContain('runManifest')
    expect(output).toContain('Run Summary')
    expect(output).toContain('Prompt Usage')
    expect(output).not.toContain('Run manifest:\n{')
    expect(output).not.toContain('"step1": {')

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const summaryJson = await Bun.file(`${outputDir}/text.json`).json() as unknown
      expect(summaryJson).toBeDefined()

      const metadata = await readRunMetadata(outputDir) as {
        completionStatus?: string
        requestedProviders?: Array<{ service?: string; model?: string }>
        providerStates?: Array<{ service?: string; model?: string; status?: string; artifactDir?: string }>
        missingProviders?: Array<unknown>
        cache?: { sourceMedia?: string }
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.completionStatus).toBe('full')
      expect(metadata.requestedProviders).toEqual([{ service: 'whisper', model: 'tiny' }])
      expect(metadata.providerStates).toEqual([
        expect.objectContaining({
          service: 'whisper',
          model: 'tiny',
          status: 'succeeded',
          artifactDir: '.'
        })
      ])
      expect(metadata.missingProviders).toEqual([])
      expect(typeof metadata.cache?.sourceMedia).toBe('string')
      expect(metadata.step3?.llmModel).toBe('ggml-org/Qwen3-0.6B-GGUF')
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  }, E2E_TEST_TIMEOUT_MS)

  budgetedTest('write-llama-qwen3-0.6b', 'write https://ajc.pics/autoshow/examples/1-audio.mp3 --llama ggml-org/Qwen3-0.6B-GGUF --prompt shortSummary longSummary', async () => {
    await stopLlamaServer()
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_EXAMPLE_AUDIO_URL, '--llama', 'ggml-org/Qwen3-0.6B-GGUF', '--prompt', 'shortSummary', 'longSummary'],
    )

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        completionStatus?: string
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.completionStatus).toBe('full')
      expect(metadata.step3?.llmModel).toBe('ggml-org/Qwen3-0.6B-GGUF')
      expect(metadata.step3?.llmService).toBe('llama.cpp')
    }
  }, E2E_TEST_TIMEOUT_MS)
})
