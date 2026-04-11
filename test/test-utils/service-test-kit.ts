import { test, expect, beforeAll, afterAll } from 'bun:test'
import { budgetedTest } from './budget'
import { runCommand, findLatestDirectory, cleanupTestOutput, hasConfiguredEnvVar } from './test-helpers'

export const withOutputLifecycle = (
  title: string,
  setup?: (() => Promise<void>) | undefined
): void => {
  beforeAll(async () => {
    if (setup) {
      await setup()
    }
    await cleanupTestOutput(title)
  })

  afterAll(async () => {
    await cleanupTestOutput(title)
  })
}

export const defineInvalidModelTest = (name: string, args: string[]): void => {
  test(name, async () => {
    const result = await runCommand(args)
    expect(result.exitCode).not.toBe(0)
  })
}

export const definePriceEstimateTest = (
  budgetKey: string,
  name: string,
  args: string[]
): void => {
  budgetedTest(budgetKey, name, async () => {
    const result = await runCommand(args)
    expect(result.exitCode).toBe(0)
  })
}

export const shouldSkipMissingEnv = async (
  envVarKey: string,
  skipMessage: string
): Promise<boolean> => {
  if (!await hasConfiguredEnvVar(envVarKey)) {
    console.log(`Skipping: ${skipMessage}`)
    return true
  }
  return false
}

export const runCommandAndExpectOutputDir = async (
  title: string,
  args: string[]
): Promise<string | null> => {
  const result = await runCommand(args)
  expect(result.exitCode).toBe(0)

  const outputDir = await findLatestDirectory(title)
  expect(outputDir).not.toBeNull()
  return outputDir
}
