import { test, expect } from 'bun:test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../../../test-utils/test-helpers'

const WHISPER_MODELS = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3-turbo',
] as const

for (const model of WHISPER_MODELS) {
  test(`whisper model ${model} --price prints estimate`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'transcribe',
      STABLE_LOCAL_AUDIO_PATH,
      '--whisper',
      model,
      '--price'
    ])

    expect(result.exitCode).toBe(0)
  })
}
