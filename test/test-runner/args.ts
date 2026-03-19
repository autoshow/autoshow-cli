import type { Tier } from '../../src/types/tests-dir-types'
import { ALL_TIERS } from './constants'

export type RunnerArgs = {
  selectedTiers: Set<Tier> | null
  priceMode: boolean
  budgetCents: number | undefined
  cleanupAfterRun: boolean
  passthroughArgs: string[]
  pathFilters: string[]
}

const parseTier = (value: string): Tier | null => {
  if (value === 'smoke') return 'smoke'
  if (value === 'local') return 'local'
  if (value === 'api') return 'api'
  if (value === 'slow-local') return 'slow-local'
  if (value === 'slow-api') return 'slow-api'
  return null
}

const SLOW_TIERS: Tier[] = ['slow-local', 'slow-api']

export const parseRunnerArgs = (argv: string[]): RunnerArgs => {
  let selectedTiers: Set<Tier> | null = null
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
      case '--tier': {
        const tierArg = argv[++i]
        if (!tierArg) {
          throw new Error('Error: --tier requires a value (smoke, local, api, slow, slow-local, slow-api)')
        }

        const tiers = tierArg.split(',').map(value => value.trim())
        const parsedTiers = new Set<Tier>()
        for (const tierValue of tiers) {
          if (tierValue === 'slow') {
            for (const st of SLOW_TIERS) parsedTiers.add(st)
            continue
          }
          const tier = parseTier(tierValue)
          if (!tier) {
            throw new Error(`Error: unknown tier "${tierValue}". Valid tiers: ${ALL_TIERS.join(', ')}, slow`)
          }
          parsedTiers.add(tier)
        }

        selectedTiers = parsedTiers
        break
      }
      case '--cleanup':            cleanupAfterRun = true; break
      case '--api':                selectedTiers = new Set<Tier>(['api']); break
      case '--api-cheap':
        throw new Error('Error: --api-cheap has been removed. Use --tier api for API tests, plus --test-price or --budget for cost preflight.')
      case '--test-price':         priceMode = true; break
      case '--timestamps':         break
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
    selectedTiers,
    priceMode,
    budgetCents,
    cleanupAfterRun,
    passthroughArgs,
    pathFilters,
  }
}
