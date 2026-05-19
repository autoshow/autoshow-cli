import type { PriceCommandSpec, PriceSelectionEntry } from '~/types'

export const exact = (selector: string, entries: PriceCommandSpec[]): PriceSelectionEntry[] => {
  return entries.map(entry => ({
    ...entry,
    selector,
    selectorKind: 'file',
  }))
}

export const prefix = (selector: string, entries: PriceCommandSpec[]): PriceSelectionEntry[] => {
  return entries.map(entry => ({
    ...entry,
    selector,
    selectorKind: 'prefix',
  }))
}

export const command = (
  name: string,
  key: string,
  args: string[],
  budgetSkippable = true
): PriceCommandSpec => ({ name, key, args, budgetSkippable })

export const reportOnly = (name: string, args: string[]): PriceCommandSpec => {
  return command(name, name, args, false)
}

export const selectorMatchesFile = (entry: PriceSelectionEntry, file: string): boolean => {
  if (entry.selectorKind === 'file') {
    return file === entry.selector
  }

  const normalizedPrefix = entry.selector.endsWith('/') ? entry.selector : `${entry.selector}/`
  return file.startsWith(normalizedPrefix)
}

export const dedupeResolvedCommands = (entries: PriceSelectionEntry[]): PriceCommandSpec[] => {
  const deduped = new Map<string, PriceCommandSpec>()

  for (const entry of entries) {
    const argsKey = entry.args.join('\u001f')
    const existing = deduped.get(argsKey)
    if (!existing) {
      deduped.set(argsKey, {
        name: entry.name,
        key: entry.key,
        args: entry.args,
        budgetSkippable: entry.budgetSkippable,
      })
      continue
    }

    if (existing.key !== entry.key || existing.name !== entry.name) {
      throw new Error(`Conflicting price registry entries for identical command args: ${entry.args.join(' ')}`)
    }

    if (!existing.budgetSkippable && entry.budgetSkippable) {
      deduped.set(argsKey, {
        name: entry.name,
        key: entry.key,
        args: entry.args,
        budgetSkippable: true,
      })
    }
  }

  return [...deduped.values()]
}
