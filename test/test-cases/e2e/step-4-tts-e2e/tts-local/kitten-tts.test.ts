import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { join } from "node:path"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from "../../../../test-utils/test-helpers"
import { budgetedTest } from '../../../../test-utils/budget'

const KITTEN_TTS_ENV_DIR = "runtime/bin/kitten-tts"
const KITTEN_PYTHON_VERSION = "3.12"

describe("kitten-tts", () => {
  describe("environment", () => {
    test("venv is configured with required packages", async () => {
      const pythonExists = await fileExists(join(KITTEN_TTS_ENV_DIR, "bin/python"))
      if (!pythonExists) {
        console.log("Skipping: Kitten TTS venv not set up (run: bun as setup)")
        return
      }
      expect(pythonExists).toBe(true)

      const kittenTtsExists = await fileExists(
        join(KITTEN_TTS_ENV_DIR, `lib/python${KITTEN_PYTHON_VERSION}/site-packages/kittentts`)
      )
      expect(kittenTtsExists).toBe(true)

      const soundfileExists = await fileExists(
        join(KITTEN_TTS_ENV_DIR, `lib/python${KITTEN_PYTHON_VERSION}/site-packages/soundfile.py`)
      )
      expect(soundfileExists).toBe(true)

      const result = Bun.spawnSync(
        [join(KITTEN_TTS_ENV_DIR, "bin/python"), "-c", "from kittentts import KittenTTS; import soundfile"],
      )
      expect(result.exitCode).toBe(0)
    })
  })

  describe("tts command", () => {
    beforeAll(async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(STABLE_TTS_MD_TITLE)
    })

    const kittenModelCases = [
      { model: 'kitten-tts-micro', speaker: 'Bella', budgetKey: 'tts-kitten-micro' },
      { model: 'kitten-tts-mini', speaker: 'Luna', budgetKey: 'tts-kitten-mini' },
      { model: 'kitten-tts-nano', speaker: 'Rosie', budgetKey: 'tts-kitten-nano' },
      { model: 'kitten-tts-nano-0.8-int8', speaker: 'Hugo', budgetKey: 'tts-kitten-nano-0.8-int8' },
    ] as const

    for (const kittenModelCase of kittenModelCases) {
      budgetedTest(kittenModelCase.budgetKey, `${kittenModelCase.model} with --tts-speaker ${kittenModelCase.speaker} generates speech.wav`, async () => {
        await cleanupTestOutput(STABLE_TTS_MD_TITLE)
        const testName = `${kittenModelCase.model} with --tts-speaker ${kittenModelCase.speaker} generates speech.wav`

        const result = await runCommand(
          [
            'src/cli/create-cli.ts',
            'tts',
            STABLE_TTS_MD_PATH,
            '--kitten-tts',
            kittenModelCase.model,
            '--tts-speaker',
            kittenModelCase.speaker
          ],
          { testName }
        )

        expect(result.exitCode).toBe(0)

        const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const audioExists = await fileExists(`${outputDir}/speech.wav`)
          expect(audioExists).toBe(true)

          const audioFile = Bun.file(`${outputDir}/speech.wav`)
          expect(audioFile.size).toBeGreaterThan(0)

          const metadata = await Bun.file(`${outputDir}/metadata.json`).json() as {
            tts?: { ttsService?: string; ttsModel?: string; chunkCount?: number; audioFileName?: string; speaker?: string }
          }
          expect(metadata.tts?.ttsService).toBe('kitten')
          expect(metadata.tts?.ttsModel).toBe(kittenModelCase.model)
          expect(metadata.tts?.chunkCount).toBeGreaterThan(0)
          expect(metadata.tts?.audioFileName).toBe('speech.wav')
          expect(metadata.tts?.speaker).toBe(kittenModelCase.speaker)
        }
      })
    }
  })

  describe("mutual exclusion", () => {
    test("rejects --kitten-tts with --elevenlabs-tts", async () => {
      const result = await runCommand(
        ["src/cli/create-cli.ts", "tts", STABLE_TTS_MD_PATH, "--kitten-tts", "kitten-tts-mini", "--elevenlabs-tts", "eleven_flash_v2_5"],
      )

      expect(result.exitCode).not.toBe(0)
    })

    test("rejects --kitten-tts with --openai-tts", async () => {
      const result = await runCommand(
        ["src/cli/create-cli.ts", "tts", STABLE_TTS_MD_PATH, "--kitten-tts", "kitten-tts-mini", "--openai-tts", "gpt-4o-mini-tts"],
      )

      expect(result.exitCode).not.toBe(0)
    })

    test("rejects invalid kitten model", async () => {
      const result = await runCommand(
        ["src/cli/create-cli.ts", "tts", STABLE_TTS_MD_PATH, "--kitten-tts", "invalid-model"],
      )

      expect(result.exitCode).not.toBe(0)
    })

    test("rejects invalid kitten speaker", async () => {
      const result = await runCommand(
        ["src/cli/create-cli.ts", "tts", STABLE_TTS_MD_PATH, "--kitten-tts", "kitten-tts-mini", "--tts-speaker", "InvalidVoice"],
      )

      expect(result.exitCode).not.toBe(0)
    })
  })
})
