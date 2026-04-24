import { expect, test } from 'bun:test'
import { STABLE_LOCAL_AUDIO_PATH, runCommand } from '../../test-utils/test-helpers'

const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(expectedMessage)
}

test('unknown command exits 2', async () => {
  await expectUsageExit(['definitely-not-a-command'], 'Unknown command "definitely-not-a-command"')
})

test('removed lyrics command exits 2', async () => {
  await expectUsageExit(['lyrics', '--audio', STABLE_LOCAL_AUDIO_PATH], 'Unknown command "lyrics"')
})

test('unknown flag exits 2', async () => {
  await expectUsageExit(['write', STABLE_LOCAL_AUDIO_PATH, '--structured'], 'Unexpected flag: structured')
})

test('deprecated step-2 command names exit 2 with migration guidance', async () => {
  for (const command of ['stt', 'ocr'] as const) {
    await expectUsageExit([command, STABLE_LOCAL_AUDIO_PATH], `The "${command}" command has been replaced by "extract"`)
  }
})

test('legacy argument order exits 2', async () => {
  await expectUsageExit(['--help', 'metadata'], 'Unsupported argument order')
})

test('music lyric-video mode rejects missing audio or batch', async () => {
  await expectUsageExit(['music', '--model', 'tiny'], 'Missing --audio (or use --batch)')
})

test('music rejects mixed hosted generation and lyric-video modes', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--minimax-music', 'music-2.5'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', 'ambient piano', '--model', 'tiny'],
    'Do not combine lyric-video flags'
  )
})

test('music lyric-video mode rejects price mode', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_LOCAL_AUDIO_PATH, '--price'],
    'Do not combine hosted music flags'
  )
})
