import { expect } from 'bun:test'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../../test-utils/budget'

const WHISPER_MODELS = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3-turbo',
] as const

for (const model of WHISPER_MODELS) {
  const budgetKey = `transcribe-whisper-${model}`

  budgetedTest(budgetKey, `whisper model ${model} --price prints estimate`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      STABLE_LOCAL_AUDIO_PATH,
      '--whisper',
      model,
      '--price'
    ])

    expect(result.exitCode).toBe(0)
  })
}
