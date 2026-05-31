import { expect, beforeAll, afterAll } from 'bun:test'
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../../test-utils/budget'
import { readRunMetadata } from '../../../../../../test-utils/manifest-helpers'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

budgetedTest('transcribe-whisper-tiny', 'default transcribe processes local audio', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'default transcribe processes local audio'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL],
    { testName }
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const promptExists = await fileExists(`${outputDir}/prompt.md`)
    expect(promptExists).toBe(true)

    const summaryExists = await fileExists(`${outputDir}/text.json`)
    expect(summaryExists).toBe(false)

    const metadata = await readRunMetadata(outputDir) as {
      resolvedStep2?: {
        route?: string
        sourceKind?: string
        providers?: Array<{ service?: string; model?: string; origin?: string }>
      }
      requestedProviders?: Array<{ service?: string; model?: string }>
      providerStates?: Array<{ service?: string; model?: string; status?: string; artifactDir?: string }>
      missingProviders?: Array<unknown>
    }
    expect(metadata.resolvedStep2).toMatchObject({
      route: 'stt',
      sourceKind: 'media',
      providers: [{ service: 'whisper', model: 'tiny', origin: 'default' }]
    })
    expect(metadata.requestedProviders).toMatchObject([{ service: 'whisper', model: 'tiny', local: true }])
    expect(metadata.providerStates).toMatchObject([
      {
        service: 'whisper',
        model: 'tiny',
        artifactDir: '.',
        status: 'succeeded'
      }
    ])
    expect(metadata.missingProviders).toEqual([])
  }
}, E2E_TEST_TIMEOUT_MS)

for (const modelCase of [
  { model: 'base', metadataSuffix: 'ggml-base' },
  { model: 'tiny', metadataSuffix: 'ggml-tiny' },
]) {
  const budgetKey = modelCase.model === 'base' ? 'transcribe-whisper-base' : 'transcribe-whisper-tiny'

  budgetedTest(budgetKey, `whisper ${modelCase.model} model transcribes local audio`, async () => {
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

    const testName = `whisper ${modelCase.model} model transcribes local audio`
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', `whisper=${modelCase.model}`],
      { testName }
    )

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
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
      expect(step2?.transcriptionModel).toContain(modelCase.metadataSuffix)

      const promptExists = await fileExists(`${outputDir}/prompt.md`)
      expect(promptExists).toBe(true)

      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(false)
    }
  }, E2E_TEST_TIMEOUT_MS)
}

budgetedTest('transcribe-whisper-split', 'split mode processes audio in segments', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'split mode processes audio in segments'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--split', '--provider', 'whisper=tiny'],
    { testName }
  )

  expect(result.exitCode).toBe(0)
  expect(stripAnsi(result.stderr)).toContain('STT Segment')

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
    const transcriptContent = await transcriptFile.text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)

    const summaryExists = await fileExists(`${outputDir}/text.json`)
    expect(summaryExists).toBe(false)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionModel?: string }
    }
    const step2 = metadata.step2
    expect(step2).toBeDefined()
    expect(step2?.transcriptionModel).toContain('ggml-tiny')

    const segmentsDirExists = await fileExists(`${outputDir}/split-attempts/pass_001/segments`)
    expect(segmentsDirExists).toBe(true)
  }
}, E2E_TEST_TIMEOUT_MS)
