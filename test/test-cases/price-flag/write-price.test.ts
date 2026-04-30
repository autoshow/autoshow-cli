import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  cleanupTestOutput,
  fileExists,
  OUTPUT_DIR,
  runCommand,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE,
  stopLlamaServer
} from '../../test-utils/test-helpers'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'

const PROJECT_PREFIX = 'autoshow-write-lyrics'

type WriteLyricsProjectFixture = {
  textDir: string
  lyricsDir: string
}

const createdProjects: string[] = []

const createWriteLyricsProject = async (): Promise<WriteLyricsProjectFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const projectName = `${PROJECT_PREFIX}-${suffix}`
  const projectDir = join(OUTPUT_DIR, projectName)
  const textDir = join(projectDir, 'text')
  const lyricsDir = join(projectDir, 'lyrics')

  await mkdir(textDir, { recursive: true })
  await writeFile(join(projectDir, 'prompt.md'), 'Write song lyrics from the provided source text.\n')
  await writeFile(join(projectDir, 'tracks.md'), '1. Track One\n2. Track Two\n')
  await writeFile(join(textDir, `01-track-one-${suffix}.md`), 'The first source text describes a late-night drive through a small town.\n')
  await writeFile(join(textDir, `02-track-two-${suffix}.txt`), 'The second source text describes the aftermath and the feeling of being watched.\n')

  createdProjects.push(projectDir)
  return { textDir, lyricsDir }
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
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)
  for (const projectDir of createdProjects) {
    await rm(projectDir, { recursive: true, force: true })
  }
})

test('ggml-org/gemma-3-270m-it-GGUF --price prints a llama cost estimate', async () => {
  const model = 'ggml-org/gemma-3-270m-it-GGUF'

  await stopLlamaServer()
  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand(
    ['src/cli/create-cli.ts', 'write', STABLE_LOCAL_AUDIO_PATH, '--llama', model, '--price'],
    { testName: `${model} --price prints a llama cost estimate` },
  )
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('llm')
  expect(output).toContain('llama')
  expect(output).toContain(model)
}, E2E_TEST_TIMEOUT_MS)

test('write project directory --price reports rendered lyric outputs without creating a run directory', async () => {
  const project = await createWriteLyricsProject()
  const dirsBefore = new Set(await listOutputDirs())

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    `./${project.textDir}`,
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()

  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Expected files')
  expect(output).toContain(`${project.lyricsDir}/*.md`)
  expect(await fileExists(project.lyricsDir)).toBe(false)

  const dirsAfter = await listOutputDirs()
  const newRunDirs = dirsAfter.filter((dir) => !dirsBefore.has(dir) && basename(dir).endsWith('_text'))
  expect(newRunDirs).toEqual([])
}, E2E_TEST_TIMEOUT_MS)
