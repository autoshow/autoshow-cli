import type {
  ProviderSpec,
  RuntimeOptions,
  Step2Command,
  Step2ProviderSelectionFilter,
  Step2ProviderSelectionOrigin,
  Step2ResolvedProviderSelection,
  Step2ShortcutFlag
} from '~/types'
import { getStep2ProviderEntries, getStep2ProviderEntry } from './entries'

const appendProviderSpec = (
  specs: ProviderSpec[],
  spec: ProviderSpec
): void => {
  const key = `${spec.provider}:${spec.model ?? ''}`
  if (specs.some((entry) => `${entry.provider}:${entry.model ?? ''}` === key)) {
    return
  }
  specs.push(spec)
}

const appendProviderSelection = (
  selections: Step2ResolvedProviderSelection[],
  selection: Step2ResolvedProviderSelection
): void => {
  const key = `${selection.providerSpecProvider}:${selection.model}`
  if (selections.some((entry) => `${entry.providerSpecProvider}:${entry.model}` === key)) {
    return
  }
  selections.push(selection)
}

const readRuntimeValue = (
  options: Record<string, unknown>,
  key: keyof RuntimeOptions
): unknown => options[key]

const readSelectionOrigins = (
  options: Record<string, unknown>
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const value = options['step2SelectionOrigins']
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}
  for (const [key, origin] of Object.entries(value)) {
    if (origin === 'default' || origin === 'explicit' || origin === 'all-shortcut') {
      origins[key] = origin
    }
  }
  return origins
}

const includeOrigin = (
  origin: Step2ProviderSelectionOrigin,
  filter?: Step2ProviderSelectionFilter
): boolean => {
  const allowedOrigins = filter?.includeOrigins
  return !allowedOrigins || allowedOrigins.includes(origin)
}

export const isStep2BooleanProviderSelected = (
  flagName: string,
  flags: Record<string, unknown>,
  allShortcutFlags: Partial<Record<Step2ShortcutFlag, boolean>>
): boolean => {
  const entry = getStep2ProviderEntry(flagName)
  if (!entry || entry.selection.type !== 'boolean') {
    return false
  }

  if (flags[entry.flagName] === true) {
    return true
  }

  return entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut] === true
}

export const collectStep2ProviderSpecs = (
  step: Step2Command,
  options: Record<string, unknown>,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []
  for (const selection of collectStep2ProviderSelections(step, options, filter)) {
    appendProviderSpec(specs, {
      provider: selection.providerSpecProvider,
      model: selection.model
    })
  }
  return specs
}

export const collectStep2ProviderSelections = (
  step: Step2Command,
  options: Record<string, unknown>,
  filter?: Step2ProviderSelectionFilter
): Step2ResolvedProviderSelection[] => {
  const selections: Step2ResolvedProviderSelection[] = []
  const selectionOrigins = readSelectionOrigins(options)
  const hasSelectionOrigins = 'step2SelectionOrigins' in options

  for (const entry of getStep2ProviderEntries(step)) {
    if (entry.selection.type === 'boolean') {
      if (readRuntimeValue(options, entry.selection.runtimeKey) !== true) {
        continue
      }

      const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)
      if (!origin || !includeOrigin(origin, filter)) {
        continue
      }

      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model: entry.selection.model,
        selectionKind: entry.selection.type,
        origin
      })
      continue
    }

    const models = readRuntimeValue(options, entry.selection.runtimeModelsKey)
    const fallback = readRuntimeValue(options, entry.selection.runtimeModelKey)
    const orderedModels = Array.isArray(models)
      ? models.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : typeof fallback === 'string' && fallback.length > 0
        ? [fallback]
        : []
    const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)

    if (!origin || !includeOrigin(origin, filter)) {
      continue
    }

    for (const model of orderedModels) {
      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model,
        selectionKind: entry.selection.type,
        origin
      })
    }
  }

  return selections
}
