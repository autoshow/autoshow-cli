import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
} from "../../../../test-utils/test-helpers"

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
  })
})
