import { test, expect, beforeAll, afterAll } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE
} from "../../test-utils/test-helpers"
import { readRunMetadata } from "../../test-utils/manifest-helpers"

const getSummaryFileName = async (outputDir: string): Promise<string> => {
  const metadata = await readRunMetadata(outputDir) as {
    step3?: { outputFileName?: string }
  }

  return metadata.step3?.outputFileName ?? "text.json"
}

beforeAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
})

test("bun setup completes successfully", async () => {
  const result = await runCommand(["src/cli/create-cli.ts", "setup"])
  
  expect(result.exitCode).toBe(0)
})

test("bun as without a subcommand prints metadata successfully", async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand(["src/cli/create-cli.ts", STABLE_LOCAL_AUDIO_PATH])
  
  expect(result.exitCode).toBe(0)

  expect(result.stdout).toContain('"title": "1-audio"')
  expect(result.stdout).toContain('"slug": "1-audio"')
})

test("bun as write processes audio successfully", async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand(["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, "--groq", "openai/gpt-oss-20b"])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (!outputDir) {
    return
  }

  const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
  expect(transcriptExists).toBe(true)

  const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
  const transcriptContent = await transcriptFile.text()
  expect(transcriptContent.length).toBeGreaterThan(0)

  const promptExists = await fileExists(`${outputDir}/prompt.md`)
  expect(promptExists).toBe(true)

  const promptFile = Bun.file(`${outputDir}/prompt.md`)
  const promptContent = await promptFile.text()
  expect(promptContent.length).toBeGreaterThan(0)

  const summaryFileName = await getSummaryFileName(outputDir)
  const summaryExists = await fileExists(`${outputDir}/${summaryFileName}`)
  expect(summaryExists).toBe(true)

  if (summaryFileName.endsWith(".json")) {
    const summaryJson = await Bun.file(`${outputDir}/${summaryFileName}`).json() as unknown
    expect(summaryJson).toBeDefined()
  } else {
    const summaryFile = Bun.file(`${outputDir}/${summaryFileName}`)
    const summaryContent = await summaryFile.text()
    expect(summaryContent.length).toBeGreaterThan(0)
  }
})

test("bun as stt skips LLM processing but creates prompt", async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  
  const result = await runCommand(["src/cli/create-cli.ts", 'stt', STABLE_LOCAL_AUDIO_PATH, "--prompt", "shortSummary"])
  
  expect(result.exitCode).toBe(0)
  
  const outputDir = await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()
  
  if (outputDir) {
    const transcriptExists = await fileExists(`${outputDir}/transcription.txt`)
    expect(transcriptExists).toBe(true)
    
    const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
    const transcriptContent = await transcriptFile.text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    
    const promptExists = await fileExists(`${outputDir}/prompt.md`)
    expect(promptExists).toBe(true)
    
    const promptFile = Bun.file(`${outputDir}/prompt.md`)
    const promptContent = await promptFile.text()
    expect(promptContent.length).toBeGreaterThan(0)
    expect(promptContent).toContain('Write a one-sentence description of the transcript')
    expect(promptContent).not.toContain('Create chapter titles and descriptions based on the topics discussed throughout')
    
    const summaryExists = await fileExists(`${outputDir}/text.json`)
    expect(summaryExists).toBe(false)
    
    const metadata = await readRunMetadata(outputDir)
    
    expect(metadata['step1']).toBeDefined()
    expect(metadata['step2']).toBeDefined()
    expect(metadata['step3']).toBeUndefined()
  }
})

test("all output files contain expected content structure", async () => {
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand(["src/cli/create-cli.ts", "write", STABLE_LOCAL_AUDIO_PATH, "--groq", "openai/gpt-oss-20b"])
  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()
  if (!outputDir) {
    return
  }

  const transcriptFile = Bun.file(`${outputDir}/transcription.txt`)
  const transcriptExists = await transcriptFile.exists()

  if (transcriptExists) {
    const transcriptContent = await transcriptFile.text()
    expect(transcriptContent.length).toBeGreaterThan(0)
    expect(transcriptContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/)
  }

  const promptFile = Bun.file(`${outputDir}/prompt.md`)
  const promptExists = await promptFile.exists()

  if (promptExists) {
    const promptContent = await promptFile.text()
    expect(promptContent).toContain('---')
    expect(promptContent).toContain('title: "1-audio"')
    expect(promptContent).toContain("Transcript:")
  }

  const summaryFileName = await getSummaryFileName(outputDir)
  const summaryFile = Bun.file(`${outputDir}/${summaryFileName}`)
  const summaryExists = await summaryFile.exists()

  if (summaryExists) {
    const summaryContent = summaryFileName.endsWith('.json')
      ? JSON.stringify(await summaryFile.json())
      : await summaryFile.text()
    expect(summaryContent.length).toBeGreaterThan(0)
  }
})
