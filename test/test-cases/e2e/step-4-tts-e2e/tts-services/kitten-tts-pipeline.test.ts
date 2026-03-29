import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  hasConfiguredEnvVar,
} from "../../../../test-utils/test-helpers"

const hasOpenAiEnv = async (): Promise<boolean> => {
  return await hasConfiguredEnvVar('OPENAI_API_KEY') || await hasConfiguredEnvVar('NITRO_OPENAI_API_KEY')
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

describe("kitten-tts pipeline", () => {
  describe("write with tts", () => {
    beforeAll(async () => {
      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
    })

    test("kitten-tts-mini runs full pipeline with --prompt shortSummary and generates speech.wav", async () => {
      const model = "kitten-tts-mini"
      const result = await runCommand(
        [
          "src/cli/create-cli.ts",
          STABLE_LOCAL_AUDIO_PATH,
          "--groq", "openai/gpt-oss-20b",
          "--kitten-tts", model,
          "--prompt", "shortSummary",
        ],
      )

      expect(result.exitCode).toBe(0)

      const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        const metadataExists = await fileExists(`${outputDir}/metadata.json`)
        expect(metadataExists).toBe(true)

        const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
          step3?: { llmService?: string; outputFileName?: string }
          step4?: { ttsService?: string; ttsModel?: string; chunkCount?: number; audioFileName?: string }
        }

        const outputFileName = metadata.step3?.outputFileName ?? "text.md"
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

        expect(metadata.step3?.llmService).toBeDefined()
        expect(metadata.step4?.ttsService).toBe("kitten")
        expect(metadata.step4?.ttsModel).toBe(model)
        expect(metadata.step4?.chunkCount).toBeGreaterThan(0)
        expect(metadata.step4?.audioFileName).toBe("speech.wav")
      }
    })

    test('write --price omits TTS estimates when multiple LLM providers are selected', async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'write',
        STABLE_LOCAL_AUDIO_PATH,
        '--openai',
        'gpt-5.4',
        '--groq',
        'openai/gpt-oss-20b',
        '--kitten-tts',
        'kitten-tts-mini',
        '--openai-tts',
        'gpt-4o-mini-tts',
        '--price'
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('TTS estimate omitted')
      expect(result.stdout).not.toContain('"step": "tts"')
      expect(result.stdout).not.toContain('speech-kitten-kitten-tts-mini.wav')
      expect(result.stdout).not.toContain('speech-openai-gpt-4o-mini-tts.wav')
    })

    test('write can emit multiple speech artifacts from one summary', async () => {
      if (!await hasOpenAiEnv()) {
        console.log('Skipping: OPENAI_API_KEY or NITRO_OPENAI_API_KEY is required for multi-provider write TTS coverage')
        return
      }

      await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

      const result = await runCommand([
        'src/cli/create-cli.ts',
        'write',
        STABLE_LOCAL_AUDIO_PATH,
        '--openai',
        'gpt-5.4',
        '--kitten-tts',
        'kitten-tts-mini',
        '--openai-tts',
        'gpt-4o-mini-tts',
        '--prompt',
        'shortSummary',
      ])

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
      expect(outputDir).not.toBeNull()

      if (outputDir) {
        expect(await fileExists(`${outputDir}/speech-kitten-kitten-tts-mini.wav`)).toBe(true)
        expect(await fileExists(`${outputDir}/speech-openai-gpt-4o-mini-tts.wav`)).toBe(true)

        const metadata = JSON.parse(await Bun.file(`${outputDir}/metadata.json`).text()) as Record<string, unknown>
        const step3 = isRecord(metadata['step3']) ? metadata['step3'] : null
        const step4Entries = toRecordArray(metadata['step4'])

        expect(step3).not.toBeNull()
        expect(step4Entries).toHaveLength(2)
        expect(step4Entries[0]?.['ttsService']).toBe('kitten')
        expect(step4Entries[1]?.['ttsService']).toBe('openai')
      }
    }, 30000)
  })
})
