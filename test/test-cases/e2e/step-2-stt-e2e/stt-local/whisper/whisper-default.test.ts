import { expect, beforeAll, afterAll } from 'bun:test'
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, STABLE_LOCAL_AUDIO_PATH, STABLE_LOCAL_AUDIO_TITLE } from '../../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../../test-utils/budget'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

beforeAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

budgetedTest('transcribe-whisper-tiny', 'default transcribe processes local audio', async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const testName = 'default transcribe processes local audio'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH],
    { testName }
  )

  expect(result.exitCode).toBe(0)
  expect(stripAnsi(result.stderr)).toContain('Whisper progress [')

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const promptExists = await fileExists(`${outputDir}/prompt.md`)
    expect(promptExists).toBe(true)

    const summaryExists = await fileExists(`${outputDir}/text.md`)
    expect(summaryExists).toBe(false)
  }
})

for (const modelCase of [
  { model: 'base', metadataSuffix: 'ggml-base' },
  { model: 'tiny', metadataSuffix: 'ggml-tiny' },
]) {
  const budgetKey = modelCase.model === 'base' ? 'transcribe-whisper-base' : 'transcribe-whisper-tiny'

  budgetedTest(budgetKey, `whisper ${modelCase.model} model transcribes local audio`, async () => {
    await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

    const testName = `whisper ${modelCase.model} model transcribes local audio`
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--whisper', modelCase.model],
      { testName }
    )

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
      expect(transcriptExists).toBe(true)

      const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
      const transcriptContent = await transcriptFile.text()
      expect(transcriptContent.length).toBeGreaterThan(0)
      expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

      const metadataFile = Bun.file(`${outputDir}/metadata.json`)
      const metadataContent = await metadataFile.text()
      const metadata = JSON.parse(metadataContent)
      expect(metadata.step2).toBeDefined()
      expect(typeof metadata.step2.transcriptionModel).toBe('string')
      expect(metadata.step2.transcriptionModel).toContain(modelCase.metadataSuffix)

      const promptExists = await fileExists(`${outputDir}/prompt.md`)
      expect(promptExists).toBe(true)

      const summaryExists = await fileExists(`${outputDir}/text.md`)
      expect(summaryExists).toBe(false)
    }
  })
}

budgetedTest('transcribe-whisper-split', 'split mode processes audio in segments', async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const testName = 'split mode processes audio in segments'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--split', '--whisper', 'tiny'],
    { testName }
  )

  expect(result.exitCode).toBe(0)
  expect(stripAnsi(result.stderr)).toContain('Whisper progress [')

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
    const transcriptContent = await transcriptFile.text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const summaryExists = await fileExists(`${outputDir}/text.md`)
    expect(summaryExists).toBe(false)

    const metadataFile = Bun.file(`${outputDir}/metadata.json`)
    const metadataContent = await metadataFile.text()
    const metadata = JSON.parse(metadataContent)
    expect(metadata.step2).toBeDefined()
    expect(metadata.step2.transcriptionModel).toContain('ggml-tiny')

    const segmentsDirExists = await fileExists(`${outputDir}/segments`)
    expect(segmentsDirExists).toBe(true)
  }
})
