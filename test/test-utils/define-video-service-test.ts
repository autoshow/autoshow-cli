import { defineInvalidModelTest, definePriceEstimateTest } from './service-test-kit'

const providerFromCliFlag = (cliFlag: string): 'gemini' | 'minimax' => {
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
  defineInvalidModelTest(`rejects invalid model for ${cliFlag}`, [
    'src/cli/create-cli.ts',
    'video',
    'a cinematic mountain sunrise',
    cliFlag,
    'invalid-model'
  ])

  for (const model of models) {
    const provider = providerFromCliFlag(cliFlag)
    const budgetKey = `video-${provider}-${model}`
    definePriceEstimateTest(budgetKey, `${model} --price prints estimate`, [
      'src/cli/create-cli.ts',
      'video',
      'a cinematic mountain sunrise',
      cliFlag,
      model,
      '--price'
    ])
  }
}
