import { buildApiCheapPriceCommands } from '../../../test-utils/api-cheap-config'
import type { PriceSelectionEntry } from '../../../../src/types/tests-dir-types'
import { exact } from '../helpers'

export const apiCheapRegistry: PriceSelectionEntry[] = exact(
  'test/test-cases/e2e/api-cheap.test.ts',
  buildApiCheapPriceCommands().map(entry => ({
    ...entry,
    key: entry.name,
    budgetSkippable: false,
  }))
)
