import type { PriceCommandSpec } from '~/types'
import {
  formatSelectedPathsLabel,
  normalizePathFilter,
  resolveSelectedFiles
} from '../path-selection'
import { dedupeResolvedCommands, selectorMatchesFile } from './helpers'
import { BUDGET_PRICE_SELECTION_REGISTRY } from './registry'

type PriceSelectionMode = 'price' | 'budget'

type ResolvePriceSelectionOptions = {
  mode?: PriceSelectionMode
  budgetSkippableOnly?: boolean
}

const TEST_PRICE_PREFIX = 'test/test-price/'

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

const rejectLegacyPriceSelectors = (pathFilters: string[]): void => {
  const legacyPriceFilters = pathFilters.filter((pathFilter) => {
    const normalized = normalizePathFilter(pathFilter)
    return normalized === 'test/test-price' || normalized.startsWith(TEST_PRICE_PREFIX)
  })
  if (legacyPriceFilters.length === 0) {
    return
  }

  throw new Error(
    `--test-price now uses normal test paths, not test/test-price selectors: ${legacyPriceFilters.join(', ')}. ` +
    'Use the matching test/test-cases/e2e/... path and append --test-price.'
  )
}

const resolveEntriesForSelectedFiles = (allFiles: string[], pathFilters: string[]) => {
  if (pathFilters.length === 0) {
    return BUDGET_PRICE_SELECTION_REGISTRY
  }

  const selectedFiles = resolveSelectedFiles(allFiles, pathFilters)
  return BUDGET_PRICE_SELECTION_REGISTRY.filter(entry => {
    return selectedFiles.some(file => selectorMatchesFile(entry, file))
  })
}

export const resolvePriceSelection = (
  allFiles: string[],
  pathFilters: string[],
  optionsOrBudgetSkippableOnly: boolean | ResolvePriceSelectionOptions = false
): { suiteName: string, commands: PriceCommandSpec[] } => {
  const options = parseResolveOptions(optionsOrBudgetSkippableOnly)
  if (options.mode === 'price') {
    rejectLegacyPriceSelectors(pathFilters)
  }

  const matchingEntries = resolveEntriesForSelectedFiles(allFiles, pathFilters)

  const filteredEntries = options.budgetSkippableOnly
    ? matchingEntries.filter(entry => entry.budgetSkippable)
    : matchingEntries

  return {
    suiteName: pathFilters.length === 0
      ? 'All mapped tests'
      : formatSelectedPathsLabel(pathFilters),
    commands: dedupeResolvedCommands(filteredEntries),
  }
}
