import { expect, beforeAll, afterAll } from "bun:test"
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from "../../../../../test-utils/test-helpers"
import { budgetedTest } from '../../../../../../test-utils/budget'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

budgetedTest('transcribe-reverb', 'reverb processes local audio with speaker diarization', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'reverb processes local audio with speaker diarization'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'reverb'],
    { testName }
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toContain('[SPEAKER_')
  }
})
