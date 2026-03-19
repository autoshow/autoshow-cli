import { test, expect } from 'bun:test'
import { runCommand } from './test-helpers'
import { budgetedTest } from './budget'

const providerFromCliFlag = (cliFlag: string): 'sora' | 'gemini' | 'minimax' => {
  if (cliFlag === '--sora-video') return 'sora'
  if (cliFlag === '--gemini-video') return 'gemini'
  return 'minimax'
}

export const defineVideoServiceTest = ({
  models,
  cliFlag,
}: {
  models: readonly string[]
  cliFlag: string
}): void => {
  test(`rejects invalid model for ${cliFlag}`, async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      cliFlag,
      'invalid-model'
    ])
    expect(result.exitCode).not.toBe(0)
  })

  for (const model of models) {
    const provider = providerFromCliFlag(cliFlag)
    const budgetKey = `video-${provider}-${model}`
    budgetedTest(budgetKey, `${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        'video',
        'a cinematic mountain sunrise',
        cliFlag,
        model,
        '--price'
      ])
      expect(result.exitCode).toBe(0)
    })
  }
}
