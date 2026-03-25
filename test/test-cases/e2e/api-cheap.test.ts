import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildApiCheapSelections } from '../../test-utils/api-cheap-config'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  hasConfiguredEnvVar,
  runCommand
} from '../../test-utils/test-helpers'

const SHORT_AUDIO_PATH = 'input/0-audio-short.mp3'
const SHORT_AUDIO_TITLE = '0-audio-short'
const SHORT_TTS_PATH = 'input/0-tts-short.txt'
const SHORT_TTS_TITLE = '0-tts-short'
const IMAGE_GEN_TITLE = 'image-gen'
const IMAGE_PROMPT = 'a tiny red dot on white background'
const MINIMAX_IMAGE_PROMPT = 'a simple red circle on white background'
const VIDEO_PROMPT = 'a static shot of a tiny red dot on white background'

const {
  llmSelections,
  sttSelections,
  ttsSelections,
  imageSelections,
  videoSelections
} = buildApiCheapSelections()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getObject = (record: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  const value = record[key]
  return isRecord(value) ? value : null
}

const getString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

const readJsonObject = async (path: string): Promise<Record<string, unknown>> => {
  const raw: unknown = JSON.parse(await Bun.file(path).text())
  if (!isRecord(raw)) {
    throw new Error(`Expected JSON object in ${path}`)
  }
  return raw
}

describe('api-cheap', () => {
  test('selects exactly one model per API service per modality', () => {
    expect(llmSelections).toHaveLength(5)
    expect(sttSelections).toHaveLength(3)
    expect(ttsSelections).toHaveLength(5)
    expect(imageSelections).toHaveLength(3)
    expect(videoSelections).toHaveLength(3)
  })

  describe('write (LLM)', () => {
    beforeAll(async () => {
      await cleanupTestOutput(SHORT_AUDIO_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(SHORT_AUDIO_TITLE)
    })

    for (const selection of llmSelections) {
      const llmTestName = `${selection.service} uses cheapest model ${selection.model}`
      test(llmTestName, async () => {
        if (!await hasConfiguredEnvVar(selection.envVar)) {
          console.log(`Skipping: ${selection.envVar} is required for ${selection.service} write test`)
          return
        }

        await cleanupTestOutput(SHORT_AUDIO_TITLE)

        const result = await runCommand(
          ['src/cli/create-cli.ts', 'write', SHORT_AUDIO_PATH, selection.flag, selection.model, '--prompt', 'shortSummary'],
          { testName: llmTestName }
        )

        expect(result.exitCode).toBe(0)

        const outputDir = await findLatestDirectory(SHORT_AUDIO_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const metadata = await readJsonObject(`${outputDir}/metadata.json`)
          const step3 = getObject(metadata, 'step3')
          expect(step3).not.toBeNull()
          if (step3) {
            const outputFileName = getString(step3, 'outputFileName') ?? 'text.md'
            expect(await fileExists(`${outputDir}/${outputFileName}`)).toBe(true)
            if (outputFileName.endsWith('.json')) {
              const summaryJson = await Bun.file(`${outputDir}/${outputFileName}`).json() as unknown
              expect(summaryJson).toBeDefined()
            } else {
              const summaryContent = await Bun.file(`${outputDir}/${outputFileName}`).text()
              expect(summaryContent.length).toBeGreaterThan(0)
            }
            expect(getString(step3, 'llmService')).toBe(selection.service)
            expect(getString(step3, 'llmModel')).toBe(selection.model)
          }
        }
      })
    }
  })

  describe('transcribe (STT)', () => {
    beforeAll(async () => {
      await cleanupTestOutput(SHORT_AUDIO_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(SHORT_AUDIO_TITLE)
    })

    for (const selection of sttSelections) {
      const sttTestName = `${selection.service} uses cheapest model ${selection.model}`
      test(sttTestName, async () => {
        if (!await hasConfiguredEnvVar(selection.envVar)) {
          console.log(`Skipping: ${selection.envVar} is required for ${selection.service} transcribe test`)
          return
        }

        await cleanupTestOutput(SHORT_AUDIO_TITLE)

        const args = ['src/cli/create-cli.ts', 'stt', SHORT_AUDIO_PATH, selection.flag, selection.model]
        if (selection.service === 'elevenlabs') {
          args.push('--speaker-count', '1')
        }

        const result = await runCommand(args, { testName: sttTestName })

        expect(result.exitCode).toBe(0)

        const outputDir = await findLatestDirectory(SHORT_AUDIO_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

          const metadata = await readJsonObject(`${outputDir}/metadata.json`)
          const step2 = getObject(metadata, 'step2')
          expect(step2).not.toBeNull()
          if (step2) {
            expect(getString(step2, 'transcriptionService')).toBe(selection.service)
            expect(getString(step2, 'transcriptionModel')).toBe(selection.model)
          }
        }
      })
    }
  })

  describe('tts', () => {
    beforeAll(async () => {
      await cleanupTestOutput(SHORT_TTS_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(SHORT_TTS_TITLE)
    })

    for (const selection of ttsSelections) {
      const ttsTestName = `${selection.service} uses cheapest model ${selection.model}`
      test(ttsTestName, async () => {
        if (!await hasConfiguredEnvVar(selection.envVar)) {
          console.log(`Skipping: ${selection.envVar} is required for ${selection.service} tts test`)
          return
        }

        const args = ['src/cli/create-cli.ts', 'tts', SHORT_TTS_PATH, selection.flag, selection.model]

        await cleanupTestOutput(SHORT_TTS_TITLE)
        const result = await runCommand(args, { testName: ttsTestName })

        expect(result.exitCode).toBe(0)

        const outputDir = await findLatestDirectory(SHORT_TTS_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const metadata = await readJsonObject(`${outputDir}/metadata.json`)
          const ttsMeta = getObject(metadata, 'tts')
          expect(ttsMeta).not.toBeNull()

          if (ttsMeta) {
            expect(getString(ttsMeta, 'ttsService')).toBe(selection.service)
            expect(getString(ttsMeta, 'ttsModel')).toBe(selection.model)

            const audioFileName = getString(ttsMeta, 'audioFileName')
            if (audioFileName) {
              expect(await fileExists(`${outputDir}/${audioFileName}`)).toBe(true)
            } else {
              expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)
            }
          }
        }
      })
    }
  })

  describe('image', () => {
    beforeAll(async () => {
      await cleanupTestOutput(IMAGE_GEN_TITLE)
    })

    afterAll(async () => {
      await cleanupTestOutput(IMAGE_GEN_TITLE)
    })

    for (const selection of imageSelections) {
      const imageTestName = `${selection.service} uses cheapest model ${selection.model}`
      test(imageTestName, async () => {
        if (!await hasConfiguredEnvVar(selection.envVar)) {
          console.log(`Skipping: ${selection.envVar} is required for ${selection.service} image test`)
          return
        }

        await cleanupTestOutput(IMAGE_GEN_TITLE)

        const prompt = selection.service === 'minimax' ? MINIMAX_IMAGE_PROMPT : IMAGE_PROMPT
        const args = ['src/cli/create-cli.ts', 'image', prompt, selection.flag, selection.model]
        if (selection.service === 'openai') {
          args.push('--image-size', '1024x1024', '--image-quality', 'low', '--image-format', 'jpeg')
        }
        if (selection.service === 'gemini' && selection.model.startsWith('imagen-')) {
          args.push('--imagen-count', '1', '--image-aspect-ratio', '1:1')
        }

        const result = await runCommand(args, { testName: imageTestName })
        expect(result.exitCode).toBe(0)

        const outputDir = await findLatestDirectory(IMAGE_GEN_TITLE)
        expect(outputDir).not.toBeNull()

        if (outputDir) {
          const metadata = await readJsonObject(`${outputDir}/metadata.json`)
          const imageMeta = getObject(metadata, 'image')
          expect(imageMeta).not.toBeNull()
          if (imageMeta) {
            expect(getString(imageMeta, 'imageService')).toBe(selection.service)
            expect(getString(imageMeta, 'imageModel')).toBe(selection.model)

            const imageFileName = getString(imageMeta, 'imageFileName')
            if (imageFileName) {
              expect(await fileExists(`${outputDir}/${imageFileName}`)).toBe(true)
            }
          }
        }
      })
    }
  })

  describe('video-price', () => {
    for (const selection of videoSelections) {
      const videoTestName = `${selection.provider} uses cheapest model ${selection.model} at minimal cost settings`
      test(videoTestName, async () => {
        const args = ['src/cli/create-cli.ts', 'video', VIDEO_PROMPT, '--price', '--video-duration', String(selection.duration)]

        if (selection.provider === 'sora') {
          args.push('--sora-video', selection.model)
          if (selection.size) args.push('--video-size', selection.size)
        } else if (selection.provider === 'gemini') {
          args.push('--gemini-video', selection.model)
          if (selection.resolution) args.push('--video-resolution', selection.resolution)
        } else {
          args.push('--minimax-video', selection.model)
          if (selection.resolution) args.push('--video-resolution', selection.resolution)
        }

        const result = await runCommand(args, { testName: videoTestName })
        expect(result.exitCode).toBe(0)
      })
    }
  })
})
