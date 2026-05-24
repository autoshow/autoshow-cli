export type RunnerArgs = {
  priceMode: boolean
  budgetHundredthCents: number | undefined
  preserveTestOutput: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}

export const DEFAULT_TEST_RUNNER_CONCURRENCY = 30

const BUN_TEST_MAX_CONCURRENCY_FLAG = '--max-concurrency'
const UNSUPPORTED_CONCURRENCY_FLAG = '--concurrency'

const unsupportedConcurrencyMessage =
  'Error: --concurrency is not a Bun test runner flag. Use --max-concurrency=<n> for per-file test concurrency and --parallel=<n> for file-level worker parallelism.'

const hasMaxConcurrencyFlag = (args: string[]): boolean =>
  args.some(arg => arg === BUN_TEST_MAX_CONCURRENCY_FLAG || arg.startsWith(`${BUN_TEST_MAX_CONCURRENCY_FLAG}=`))

export const withDefaultTestConcurrency = (args: string[]): string[] =>
  hasMaxConcurrencyFlag(args)
    ? args
    : [`${BUN_TEST_MAX_CONCURRENCY_FLAG}=${DEFAULT_TEST_RUNNER_CONCURRENCY}`, ...args]

export const parseRunnerArgs = (argv: string[]): RunnerArgs => {
  let priceMode = false
  let budgetHundredthCents: number | undefined
  let preserveTestOutput = false
  const passthroughArgs: string[] = []
  const pathFilters: string[] = []

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (typeof arg !== 'string') {
      continue
    }

    switch (arg) {
      case '--cleanup':            break
      case '--no-cleanup':         preserveTestOutput = true; break
      case '--test-price':         priceMode = true; break
      case UNSUPPORTED_CONCURRENCY_FLAG:
        throw new Error(unsupportedConcurrencyMessage)
      case '--testprice':
        throw new Error('Error: --testprice is not supported. Use --test-price for test-runner price mode.')
      case '--budget': {
        const value = argv[++i]
        if (!value) {
          throw new Error('Error: --budget requires a whole-number value in hundredths of a cent (for example: --budget 100 for 1 cent)')
        }
        if (!/^\d+$/.test(value)) {
          throw new Error(`Error: invalid --budget value "${value}". Use whole-number hundredths of a cent (for example: --budget 100 for 1 cent).`)
        }
        const parsed = Number.parseInt(value, 10)
        if (!Number.isFinite(parsed)) {
          throw new Error(`Error: invalid --budget value "${value}".`)
        }
        budgetHundredthCents = parsed
        break
      }
      case '--price':
        throw new Error('Error: --price is a runtime CLI flag. Use --test-price for test-runner price mode.')
      case '--':                   break
      default:
        if (arg.startsWith(`${UNSUPPORTED_CONCURRENCY_FLAG}=`)) {
          throw new Error(unsupportedConcurrencyMessage)
        }
        if (!arg.startsWith('-') && (arg.includes('/') || arg.endsWith('.ts'))) {
          pathFilters.push(arg)
        } else {
          passthroughArgs.push(arg)
      }
    }
  }

  return {
    priceMode,
    budgetHundredthCents,
    preserveTestOutput,
    passthroughArgs,
    pathFilters,
  }
}
