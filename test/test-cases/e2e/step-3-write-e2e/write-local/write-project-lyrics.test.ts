import { afterAll, beforeAll, expect } from 'bun:test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  OUTPUT_DIR,
  runCommand,
  stopLlamaServer
} from '../../../../test-utils/test-helpers'
import { readBatchManifest, readRunManifest } from '../../../../test-utils/manifest-helpers'

const PROJECT_PREFIX = 'autoshow-write-lyrics'

type WriteLyricsProjectFixture = {
  projectName: string
  projectDir: string
  textDir: string
  lyricsDir: string
  trackOneStem: string
  trackTwoStem: string
  trackOnePath: string
}

const createdProjects: string[] = []
const createdRunDirs: string[] = []

const createWriteLyricsProject = async (): Promise<WriteLyricsProjectFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const projectName = `${PROJECT_PREFIX}-${suffix}`
  const projectDir = join(OUTPUT_DIR, projectName)
  const textDir = join(projectDir, 'text')
  const lyricsDir = join(projectDir, 'lyrics')
  const trackOneStem = `01-track-one-${suffix}`
  const trackTwoStem = `02-track-two-${suffix}`
  const trackOnePath = join(textDir, `${trackOneStem}.md`)

  await mkdir(textDir, { recursive: true })
  await writeFile(join(projectDir, 'prompt.md'), 'Write song lyrics from the provided source text.\n')
  await writeFile(join(projectDir, 'tracks.md'), '1. Track One\n2. Track Two\n')
  await writeFile(trackOnePath, 'The first source text describes a late-night drive through a small town.\n')
  await writeFile(join(textDir, `${trackTwoStem}.txt`), 'The second source text describes the aftermath and the feeling of being watched.\n')

  createdProjects.push(projectDir)
  return {
    projectName,
    projectDir,
    textDir,
    lyricsDir,
    trackOneStem,
    trackTwoStem,
    trackOnePath
  }
}

const rememberRunDir = (outputDir: string | null): void => {
  if (outputDir) {
    createdRunDirs.push(outputDir)
  }
}

const listOutputDirs = async (): Promise<string[]> => {
  try {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(OUTPUT_DIR, entry.name))
      .sort()
  } catch {
    return []
  }
}

beforeAll(async () => {
  await stopLlamaServer()
})

afterAll(async () => {
  await stopLlamaServer()
  for (const runDir of createdRunDirs) {
    await rm(runDir, { recursive: true, force: true })
  }
  for (const projectDir of createdProjects) {
    await rm(projectDir, { recursive: true, force: true })
  }
})

budgetedTest('write-project-lyrics-single-default-llama', 'write project single-file mode renders lyrics and writes a standard write manifest', async () => {
  await stopLlamaServer()
  const project = await createWriteLyricsProject()
  await cleanupTestOutput(project.trackOneStem)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    `./${project.trackOnePath}`,
    '--prompt',
    'folkSong'
  ])
  rememberRunDir(result.outputDir)

  expect(result.exitCode).toBe(0)

  const renderedLyricsPath = join(project.lyricsDir, `${project.trackOneStem}-llama.md`)
  expect(await fileExists(renderedLyricsPath)).toBe(true)

  const renderedLyrics = await Bun.file(renderedLyricsPath).text()
  expect(renderedLyrics).toContain('01. Track One (Gemma 3 270M Instruct)')

  expect(result.outputDir).not.toBeNull()
  if (result.outputDir) {
    const manifest = await readRunManifest(result.outputDir)
    expect(manifest.kind).toBe('write')
    expect((manifest.metadata['source'] as Record<string, unknown>)['kind']).toBe('text-input')
    const step3 = manifest.metadata['step3'] as Record<string, unknown>
    expect(step3['llmService']).toBe('llama.cpp')
  }
}, E2E_TEST_TIMEOUT_MS)

budgetedTest('write-project-lyrics-directory-default-llama', 'write project directory mode creates a write batch and rendered markdown for each source file', async () => {
  await stopLlamaServer()
  const project = await createWriteLyricsProject()
  await cleanupTestOutput(project.trackOneStem)
  await cleanupTestOutput(project.trackTwoStem)
  const dirsBefore = new Set(await listOutputDirs())

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    `./${project.textDir}`,
    '--prompt',
    'shortSummary'
  ])

  expect(result.exitCode).toBe(0)

  const dirsAfter = await listOutputDirs()
  const batchDir = dirsAfter.find((dir) => !dirsBefore.has(dir) && basename(dir).endsWith('_text'))
  expect(batchDir).toBeDefined()
  if (batchDir) {
    createdRunDirs.push(batchDir)
  }

  expect(await fileExists(join(project.lyricsDir, `${project.trackOneStem}-llama.md`))).toBe(true)
  expect(await fileExists(join(project.lyricsDir, `${project.trackTwoStem}-llama.md`))).toBe(true)

  if (batchDir) {
    const manifest = await readBatchManifest(resolve(process.cwd(), batchDir))
    expect(manifest.kind).toBe('write')
    expect(manifest.items).toHaveLength(2)

    for (const item of manifest.items as Array<Record<string, unknown>>) {
      const outputDir = resolve(process.cwd(), String(item['outputDir']))
      expect(await fileExists(`${outputDir}/run.json`)).toBe(true)
      const childManifest = await readRunManifest(outputDir)
      expect(childManifest.kind).toBe('write')
    }
  }
}, E2E_TEST_TIMEOUT_MS)
