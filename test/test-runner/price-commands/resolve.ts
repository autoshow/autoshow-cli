import type { PriceCommandSpec } from '~/types'
import {
  formatSelectedPathsLabel,
  formatSelectedPriceSuitesLabel,
  matchPathFilters,
  normalizePathFilter,
  resolveSelectedFiles
} from '../path-selection'
import { dedupeResolvedCommands, selectorMatchesFile } from './helpers'
import {
  BUDGET_PRICE_SELECTION_REGISTRY,
  PRICE_SELECTION_REGISTRY,
  resolvePriceSuiteSelectorsForE2eSelector
} from './registry'

type PriceSelectionMode = 'price' | 'budget'

type ResolvePriceSelectionOptions = {
  mode?: PriceSelectionMode
  budgetSkippableOnly?: boolean
}

const E2E_PREFIX = 'test/test-cases/e2e/'
const PRICE_CATALOG_PREFIX = 'test/test-price/catalog/'

const parseResolveOptions = (
  optionsOrBudgetSkippableOnly: boolean | ResolvePriceSelectionOptions
): Required<ResolvePriceSelectionOptions> => {
  if (typeof optionsOrBudgetSkippableOnly === 'boolean') {
    return {
      mode: optionsOrBudgetSkippableOnly ? 'budget' : 'price',
      budgetSkippableOnly: optionsOrBudgetSkippableOnly
    }
  }

  return {
    mode: optionsOrBudgetSkippableOnly.mode ?? 'price',
    budgetSkippableOnly: optionsOrBudgetSkippableOnly.budgetSkippableOnly ?? false
  }
}

const rejectE2eSelectorsInPriceMode = (pathFilters: string[]): void => {
  const e2eFilters = pathFilters.filter((pathFilter) => {
    const normalized = normalizePathFilter(pathFilter)
    return normalized === 'test/test-cases/e2e' || normalized.startsWith(E2E_PREFIX)
  })
  if (e2eFilters.length === 0) {
    return
  }

  const suggestedSelectors = [
    ...new Set(e2eFilters.flatMap((pathFilter) => resolvePriceSuiteSelectorsForE2eSelector(pathFilter)))
  ].sort()
  const suggestion = suggestedSelectors.length === 0
    ? 'Use selectors under test/test-price/... with --test-price.'
    : suggestedSelectors.length === 1
      ? `Use --test-price ${suggestedSelectors[0]} instead.`
      : `Use one of these --test-price selectors instead: ${suggestedSelectors.join(', ')}.`

  throw new Error(`--test-price no longer accepts e2e test paths: ${e2eFilters.join(', ')}. ${suggestion}`)
}

const resolvePriceSuiteEntries = (pathFilters: string[]) => {
  if (pathFilters.length === 0) {
    return PRICE_SELECTION_REGISTRY.filter(entry => !entry.selector.startsWith(PRICE_CATALOG_PREFIX))
  }

  rejectE2eSelectorsInPriceMode(pathFilters)
  return PRICE_SELECTION_REGISTRY.filter(entry =>
    pathFilters.some(pathFilter => matchPathFilters(entry.selector, [pathFilter]))
  )
}

export const resolvePriceSelection = (
  allFiles: string[],
  pathFilters: string[],
  optionsOrBudgetSkippableOnly: boolean | ResolvePriceSelectionOptions = false
): { suiteName: string, commands: PriceCommandSpec[] } => {
  const options = parseResolveOptions(optionsOrBudgetSkippableOnly)
  const matchingEntries = options.mode === 'budget'
    ? (() => {
        const selectedFiles = resolveSelectedFiles(allFiles, pathFilters)
        return BUDGET_PRICE_SELECTION_REGISTRY.filter(entry => {
          return selectedFiles.some(file => selectorMatchesFile(entry, file))
        })
      })()
    : resolvePriceSuiteEntries(pathFilters)

  const filteredEntries = options.budgetSkippableOnly
    ? matchingEntries.filter(entry => entry.budgetSkippable)
    : matchingEntries

  return {
    suiteName: pathFilters.length === 0
      ? options.mode === 'budget' ? 'All mapped tests' : 'All mapped price suites'
      : options.mode === 'budget' ? formatSelectedPathsLabel(pathFilters) : formatSelectedPriceSuitesLabel(pathFilters),
    commands: dedupeResolvedCommands(filteredEntries),
  }
}
