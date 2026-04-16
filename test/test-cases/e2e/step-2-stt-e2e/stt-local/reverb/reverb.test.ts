import { expect, beforeAll, afterAll } from "bun:test"
import { runCommand, fileExists, findLatestDirectory, cleanupTestOutput, STABLE_LOCAL_AUDIO_PATH, STABLE_LOCAL_AUDIO_TITLE } from "../../../../../test-utils/test-helpers"
import { budgetedTest } from '../../../../../test-utils/budget'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

budgetedTest('transcribe-reverb', "reverb processes local audio with speaker diarization and verbatimicity options", async () => {
  const testName = "reverb processes local audio with speaker diarization and verbatimicity options"
  const result = await runCommand(
    ["src/cli/create-cli.ts", 'stt', STABLE_LOCAL_AUDIO_PATH, "--reverb", "--reverb-verbatimicity", "0.5"],
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
    expect(transcriptContent).toContain("[SPEAKER_")
  }
})

budgetedTest('transcribe-reverb', 'reverb processes local audio without verbatimicity option', async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const testName = 'reverb processes local audio without verbatimicity option'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'stt', STABLE_LOCAL_AUDIO_PATH, '--reverb'],
    { testName }
  )

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)

    const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toContain('[SPEAKER_')
  }
})
