import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'

const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-stt-batch-preflight-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('stt batch preflight', () => {
  test('expands input lists before non-price cloud STT preflight', async () => {
    const tempDir = await createTempDir()
    const inputListPath = join(tempDir, 'inputs.md')
    const configPath = join(tempDir, 'autoshow.json')

    await writeFile(inputListPath, `${resolve('input/examples/audio/1-audio.mp3')}\n`)
    await writeFile(configPath, JSON.stringify({ pricing: { maxCents: 0 } }, null, 2))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'stt',
      inputListPath,
      '--elevenlabs-stt',
      'scribe_v2',
      '--config-path',
      configPath
    ])

    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(2)
    expect(output).toContain('exceeds configured budget')
    expect(output).not.toContain('Input file is too small')
  })

  test('--price honors input-list batch selection before estimating', async () => {
    const tempDir = await createTempDir()
    const inputListPath = join(tempDir, 'inputs.md')
    const configPath = join(tempDir, 'autoshow.json')
    const notePath = join(tempDir, 'note.md')

    await writeFile(notePath, '# not audio\n')
    await writeFile(inputListPath, `${resolve('input/examples/audio/1-audio.mp3')}\n${notePath}\n`)
    await writeFile(configPath, JSON.stringify({}, null, 2))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'stt',
      inputListPath,
      '--elevenlabs-stt',
      'scribe_v2',
      '--batch-limit',
      '1',
      '--price',
      '--config-path',
      configPath
    ])

    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(output).not.toContain('Input file is too small')
  })
})
