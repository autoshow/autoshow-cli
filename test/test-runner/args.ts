export type RunnerArgs = {
  priceMode: boolean
  budgetCents: number | undefined
  cleanupAfterRun: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}

export const parseRunnerArgs = (argv: string[]): RunnerArgs => {
  let priceMode = false
  let budgetCents: number | undefined
  let cleanupAfterRun = false
  const passthroughArgs: string[] = []
  const pathFilters: string[] = []

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (typeof arg !== 'string') {
      continue
    }

    switch (arg) {
      case '--cleanup':            cleanupAfterRun = true; break
      case '--test-price':         priceMode = true; break
      case '--budget': {
        const value = argv[++i]
        if (!value) {
          throw new Error('Error: --budget requires a whole-number value in cents (for example: --budget 5)')
        }
        if (!/^\d+$/.test(value)) {
          throw new Error(`Error: invalid --budget value "${value}". Use whole-number cents (for example: --budget 5).`)
        }
        const parsed = Number.parseInt(value, 10)
        if (!Number.isFinite(parsed)) {
          throw new Error(`Error: invalid --budget value "${value}".`)
        }
        budgetCents = parsed
        break
      }
      case '--price':
        throw new Error('Error: --price is a runtime CLI flag. Use --test-price for test-runner price mode.')
      case '--':                   break
      default:
        if (!arg.startsWith('-') && (arg.includes('/') || arg.endsWith('.ts'))) {
          pathFilters.push(arg)
        } else {
          passthroughArgs.push(arg)
      }
    }
  }

  return {
    priceMode,
    budgetCents,
    cleanupAfterRun,
    passthroughArgs,
    pathFilters,
  }
}
