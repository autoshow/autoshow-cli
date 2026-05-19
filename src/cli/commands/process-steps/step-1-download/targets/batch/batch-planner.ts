import * as l from '~/utils/logger'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import type { BatchItem, BatchManifestEntry, PlannedBatchInput, ProcessCommand, RuntimeOptions } from '~/types'
import { buildBatchManifestEntryForItem } from './batch-manifest'
import { describeUnsupportedInputForCommand, resolveInputRoutingForCommand } from '../routing/input-routing'

export const planBatchInputsForCommand = async (
  command: ProcessCommand,
  items: string[],
  opts: RuntimeOptions,
  selectedItems?: Array<BatchItem | undefined>,
  logSkips = true
): Promise<{
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: BatchManifestEntry[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
}> => {
  if (command === 'write' && opts.textInput) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialEntries: items.map((item, index) => ({
        ...buildBatchManifestEntryForItem(item, selectedItems?.[index]),
        sourceKind: 'text-input'
      })),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const shouldResolveRouting = isExtractCommand(command) || command === 'write'
  if (!shouldResolveRouting) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialEntries: items.map((item, index) => buildBatchManifestEntryForItem(item, selectedItems?.[index])),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const filteredItems: string[] = []
  const filteredSelectedItems: Array<BatchItem | undefined> = []
  const initialEntries: BatchManifestEntry[] = []
  const resultEntryIndexes: number[] = []
  const plannedInputs: PlannedBatchInput[] = []

  for (const [index, item] of items.entries()) {
    const batchItem = selectedItems?.[index]
    const routing = await resolveInputRoutingForCommand(command, item, opts)
    const entryBase = {
      ...buildBatchManifestEntryForItem(item, batchItem),
      ...(routing.family !== 'unsupported' ? { inputFamily: routing.family } : {}),
      step2Route: routing.step2Route,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.extractRoute ? { extractRoute: routing.extractRoute } : {})
    }
    plannedInputs.push({
      input: item,
      inputFamily: routing.family,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.extractRoute ? { extractRoute: routing.extractRoute } : {}),
      ...(batchItem ? { batchItem } : {})
    })

    if (!routing.supported) {
      const reason = routing.skipReason ?? describeUnsupportedInputForCommand(command, routing.family)
      if (logSkips && isExtractCommand(command)) {
        l.warn(`Skipping ${routing.family} input in ${command} batch: ${item} (${reason})`)
      }
      initialEntries.push({
        ...entryBase,
        completionStatus: 'skipped',
        inputFamily: routing.family,
        skipReason: reason
      })
      continue
    }

    initialEntries.push(entryBase)
    resultEntryIndexes.push(initialEntries.length - 1)
    filteredItems.push(item)
    if (batchItem) {
      filteredSelectedItems.push(batchItem)
    }
  }

  return {
    items: filteredItems,
    ...(selectedItems ? { selectedItems: filteredSelectedItems } : {}),
    initialEntries,
    resultEntryIndexes,
    plannedInputs
  }
}
