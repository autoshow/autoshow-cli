import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

const INCLUDE_PATHS = [
  // '**/*'
  'src/*'

]

const IGNORE_PATHS = [
  'new-*.md',
  'TODO.md',
  'src/tools/repomix.ts',
  'project/reports',
  'project/links/all-all-links.md'
]

const DEFAULT_INSTRUCTION = "I'm going to ask you to refactor my code, write a new feature, or fix a bug.\n"

const resolveInstructionFile = async (): Promise<{ path: string, tempDir?: string }> => {
  const projectInstruction = join(PROJECT_ROOT, 'repomix-instruction.md')
  if (await Bun.file(projectInstruction).exists()) {
    return { path: projectInstruction }
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-repomix-'))
  const instructionPath = join(tempDir, 'repomix-instruction-temp.md')
  await Bun.write(instructionPath, DEFAULT_INSTRUCTION)
  console.log(`Created temporary instruction file: ${instructionPath}`)
  return { path: instructionPath, tempDir }
}

const resolveOutputFile = async (): Promise<string> => {
  let counter = 1
  while (true) {
    const fileName = `new-llm-${counter}.md`
    if (!await Bun.file(join(PROJECT_ROOT, fileName)).exists()) {
      return fileName
    }
    counter++
  }
}

const run = async (): Promise<number> => {
  const instruction = await resolveInstructionFile()
  const outputFile = await resolveOutputFile()
  const repomixBin = join(PROJECT_ROOT, 'node_modules/repomix/bin/repomix.cjs')

  try {
    if (!await Bun.file(repomixBin).exists()) {
      console.error('repomix is not installed. Run bun install before bun run repo.')
      return 1
    }

    const proc = Bun.spawn([
      'bun',
      repomixBin,
      '--instruction-file-path',
      instruction.path,
      '--include',
      INCLUDE_PATHS.join(','),
      '--ignore',
      IGNORE_PATHS.join(','),
      '--style',
      'markdown',
      '--output',
      outputFile,
      '--token-count-encoding',
      'o200k_base',
      '--top-files-len',
      '20',
      '--no-git-sort-by-changes',
      '--no-file-summary',
      '--no-security-check'
    ], {
      cwd: PROJECT_ROOT,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    })

    const exitCode = await proc.exited
    if (exitCode === 0) {
      console.log(`Successfully created ${outputFile}`)
    } else {
      console.error('Error running repomix command')
    }
    return exitCode
  } finally {
    if (instruction.tempDir) {
      await rm(instruction.tempDir, { recursive: true, force: true })
    }
  }
}

process.exit(await run())
