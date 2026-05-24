import { describe, expect } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  isRecord,
  toRecordArray,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from "../../../../../test-utils/test-helpers"
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from "../../../../../test-utils/budget"
import { readRunMetadata } from "../../../../../test-utils/manifest-helpers"
import { requireConfiguredEnvVar } from "../../../../../test-utils/service-test-kit"

describe("kitten-tts pipeline", () => {
  describe("write with tts", () => {
    budgetedTest(['write-groq-openai/gpt-oss-20b', 'tts-kitten-mini'], "kitten-tts-mini runs full pipeline with --prompt shortSummary and generates speech.wav", async () => {
      const model = "kitten-tts-mini"
      const result = await runCommand(
        [
          "src/cli/create-cli.ts",
          "write",
          STABLE_EXAMPLE_AUDIO_URL,
          "--llm", "groq=openai/gpt-oss-20b",
          "--tts", `kitten=${model}`,
          "--prompt", "shortSummary",
        ],
      )

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const metadataExists = await fileExists(`${outputDir}/run.json`)
        expect(metadataExists).toBe(true)

        const metadata = await readRunMetadata(outputDir) as Record<string, unknown>
        const step3 = isRecord(metadata['step3']) ? metadata['step3'] : null
        const step4Entries = toRecordArray(metadata['step4'])

        const outputFileName = typeof step3?.['outputFileName'] === 'string' ? step3['outputFileName'] : 'text.json'
        const summaryExists = await fileExists(`${outputDir}/${outputFileName}`)
        expect(summaryExists).toBe(true)

        if (outputFileName.endsWith(".json")) {
          const summaryJson = await Bun.file(`${outputDir}/${outputFileName}`).json() as unknown
          expect(summaryJson).toBeDefined()
        } else {
          const summaryContent = await Bun.file(`${outputDir}/${outputFileName}`).text()
          expect(summaryContent.length).toBeGreaterThan(0)
        }

        const audioExists = await fileExists(`${outputDir}/speech.wav`)
        expect(audioExists).toBe(true)

        const audioFile = Bun.file(`${outputDir}/speech.wav`)
        expect(audioFile.size).toBeGreaterThan(0)

        expect(step3?.['llmService']).toBeDefined()
        expect(step4Entries[0]?.['ttsService']).toBe("kitten")
        expect(step4Entries[0]?.['ttsModel']).toBe(model)
        expect(step4Entries[0]?.['chunkCount']).toBeGreaterThan(0)
        expect(step4Entries[0]?.['audioFileName']).toBe("speech.wav")
      }
    })

    budgetedTest(['write-openai-gpt-5.4', 'tts-kitten-mini', 'tts-openai-gpt-4o-mini-tts'], 'write can emit multiple speech artifacts from one summary', async () => {
      await requireConfiguredEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY is required for multi-provider write TTS coverage')

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'write',
        STABLE_EXAMPLE_AUDIO_URL,
        '--llm',
        'openai=gpt-5.4',
        '--tts',
        'kitten=kitten-tts-mini',
        '--tts',
        'openai=gpt-4o-mini-tts',
        '--prompt',
        'shortSummary',
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech-kitten-kitten-tts-mini.wav`)).toBe(true)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts.wav`)).toBe(true)

        const metadata = await readRunMetadata(outputDir)
        const step3 = isRecord(metadata['step3']) ? metadata['step3'] : null
        const step4Entries = toRecordArray(metadata['step4'])

        expect(step3).not.toBeNull()
        expect(step4Entries).toHaveLength(2)
        expect(step4Entries[0]?.['ttsService']).toBe('kitten')
        expect(step4Entries[1]?.['ttsService']).toBe('openai')
      }
    }, E2E_TEST_TIMEOUT_MS)
  })
})
