import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const DELETED_PRIVATE_MODULES = [
  'src/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner.ts',
  'src/cli/commands/process-steps/step-2-stt/stt-batch/resume-stt-batch.ts',
  'src/cli/commands/process-steps/step-2-ocr/resume-ocr-batch.ts',
  'src/cli/commands/setup-and-utilities/report/stt-consensus-report.ts',
  'src/cli/commands/setup-and-utilities/report/ocr-consensus-report.ts'
] as const

const FORBIDDEN_IMPORT_FRAGMENTS = [
  'step-2-stt/stt-utils/async-stt-job-runner',
  'step-2-stt/stt-batch/resume-stt-batch',
  'step-2-ocr/resume-ocr-batch',
  'setup-and-utilities/report/stt-consensus-report',
  'setup-and-utilities/report/ocr-consensus-report'
] as const

const collectSourceFiles = async (root: string): Promise<string[]> => {
  const files: string[] = []
  const pending = [root]

  while (pending.length > 0) {
    const currentDir = pending.pop()
    if (!currentDir) {
      continue
    }

    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
        continue
      }

      if (entry.isFile() && path.endsWith('.ts')) {
        files.push(path)
      }
    }
  }

  return files
}

test('phase 3 removes superseded private STT/OCR modules after callers move to stable roots', async () => {
  for (const path of DELETED_PRIVATE_MODULES) {
    expect(await Bun.file(path).exists(), `${path} should be removed in phase 3`).toBe(false)
  }
})

test('phase 3 source files no longer import superseded private STT/OCR modules', async () => {
  const sourceFiles = await collectSourceFiles('src')

  for (const path of sourceFiles) {
    const source = await Bun.file(path).text()
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      expect(source, `${path} should not reference ${fragment}`).not.toContain(fragment)
    }
  }
})
