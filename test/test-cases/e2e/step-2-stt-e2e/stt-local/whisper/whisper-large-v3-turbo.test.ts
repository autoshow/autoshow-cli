import { expect, beforeAll, afterAll } from 'bun:test'
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../../test-utils/budget'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'

const videoInputPath = 'https://ajc.pics/autoshow/examples/2-video.mp4'
const videoTitleSuffix = '2-video'

const cleanupVideoOutput = async () => {
  await cleanupTestOutput(videoTitleSuffix)
}

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  await cleanupVideoOutput()
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  await cleanupVideoOutput()
})

budgetedTest('transcribe-whisper-large-v3-turbo', 'whisper large-v3-turbo model transcribes local audio', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'whisper large-v3-turbo model transcribes local audio'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--whisper', 'large-v3-turbo'],
    { testName }
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
    const transcriptContent = await transcriptFile.text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionModel?: string }
    }
    const step2 = metadata.step2
    expect(step2).toBeDefined()
    expect(typeof step2?.transcriptionModel).toBe('string')
    expect(step2?.transcriptionModel).toContain('ggml-large-v3-turbo')

    const promptExists = await fileExists(`${outputDir}/prompt.md`)
    expect(promptExists).toBe(true)

    const summaryExists = await fileExists(`${outputDir}/text.json`)
    expect(summaryExists).toBe(false)
  }
})

budgetedTest('transcribe-whisper-tiny-split', 'whisper tiny with split processes video input', async () => {
  await cleanupVideoOutput()

  const testName = 'whisper tiny with split processes video input'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', videoInputPath, '--whisper', 'tiny', '--split'],
    { testName }
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(videoTitleSuffix)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionModel?: string }
    }
    const step2 = metadata.step2
    expect(step2).toBeDefined()
    expect(step2?.transcriptionModel).toContain('ggml-tiny')

    const segmentsDirExists = await fileExists(`${outputDir}/split-attempts/pass_001/segments`)
    expect(segmentsDirExists).toBe(true)
  }
})
