import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyInputFamily,
  classifyUrlInput
} from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { STABLE_EXAMPLE_AUDIO_URL, runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []

const createUnsupportedInput = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-next-input-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'unknown.payload')
  await writeFile(filePath, 'plain text without a supported extension')
  return filePath
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('input classification contracts', () => {
  test('media URLs are classified as media input', async () => {
    await expect(classifyUrlInput('https://example.com/audio.mp3?token=redacted')).resolves.toBe('url_direct_media')
    await expect(classifyInputFamily('https://example.com/audio.mp3?token=redacted')).resolves.toBe('media')
  })

  test('document and HTML URLs are classified as document-family inputs', async () => {
    await expect(classifyUrlInput('https://example.com/files/report.pdf')).resolves.toBe('url_direct_document')
    await expect(classifyInputFamily('https://example.com/files/report.pdf')).resolves.toBe('document')
    await expect(classifyInputFamily('https://example.com/articles/post.html')).resolves.toBe('html_article')
  })

  test('unsupported input types produce a usage error message', async () => {
    const inputPath = await createUnsupportedInput()
    const result = await runCommand(['src/cli/create-cli.ts', 'extract', inputPath, '--price'])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain(`Could not classify extract input "${inputPath}"`)
  })

  test('write rejects multiple step-2 providers for one routed media input', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      STABLE_EXAMPLE_AUDIO_URL,
      '--stt',
      'whisper=tiny',
      '--stt',
      'assemblyai=universal-3-pro',
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('write accepts at most one STT provider')
  })
})
