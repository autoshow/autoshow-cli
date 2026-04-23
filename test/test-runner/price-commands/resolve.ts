import type { PriceCommandSpec } from '~/types'
import { formatSelectedPathsLabel, resolveSelectedFiles } from '../path-selection'
import { dedupeResolvedCommands, selectorMatchesFile } from './helpers'
import { PRICE_SELECTION_REGISTRY } from './registry'

export const resolvePriceSelection = (
  allFiles: string[],
  pathFilters: string[],
  budgetSkippableOnly = false
): { suiteName: string, commands: PriceCommandSpec[] } => {
  const selectedFiles = resolveSelectedFiles(allFiles, pathFilters)
  const matchingEntries = PRICE_SELECTION_REGISTRY.filter(entry => {
    return selectedFiles.some(file => selectorMatchesFile(entry, file))
  })

  const filteredEntries = budgetSkippableOnly
    ? matchingEntries.filter(entry => entry.budgetSkippable)
    : matchingEntries

  return {
    suiteName: pathFilters.length === 0 ? 'All mapped tests' : formatSelectedPathsLabel(pathFilters),
    commands: dedupeResolvedCommands(filteredEntries),
  }
}
