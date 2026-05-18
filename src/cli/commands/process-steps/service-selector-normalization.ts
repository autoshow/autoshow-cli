import { CLIUsageError } from '~/utils/error-handler'

export type SelectorFlagMap = Record<string, string>

export type SelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
}

const occurrenceValues = (value: unknown): Array<string | boolean> => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string | true => typeof entry === 'string' || entry === true)
  }
  return typeof value === 'string' || value === true ? [value] : []
}

const appendFlagValue = (
  flags: Record<string, unknown>,
  flagName: string,
  value: string | boolean
): void => {
  const current = flags[flagName]
  if (Array.isArray(current)) {
    current.push(value)
    return
  }
  if (current !== undefined) {
    flags[flagName] = [current, value]
    return
  }
  flags[flagName] = value
}

export const normalizeCommandSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  publicNameByInternalName: SelectorFlagMap
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  for (const [internalName, publicName] of Object.entries(publicNameByInternalName)) {
    const values = occurrenceValues(normalizedFlags[publicName])
    if (values.length === 0) {
      continue
    }

    delete normalizedFlags[publicName]
    for (const value of values) {
      appendFlagValue(normalizedFlags, internalName, value)
    }
    if (normalizedExplicitFlags.has(publicName)) {
      normalizedExplicitFlags.delete(publicName)
      normalizedExplicitFlags.add(internalName)
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}

export const normalizeCommandSelectorArgs = (
  argv: string[],
  publicNameByInternalName: SelectorFlagMap
): string[] => {
  const internalNameByPublicName = new Map(
    Object.entries(publicNameByInternalName).map(([internalName, publicName]) => [publicName, internalName])
  )

  return argv.map((arg) => {
    if (!arg.startsWith('--') || arg === '--') {
      return arg
    }

    const raw = arg.slice(2)
    const eqIndex = raw.indexOf('=')
    const name = eqIndex === -1 ? raw : raw.slice(0, eqIndex)
    const internalName = internalNameByPublicName.get(name)
    if (!internalName) {
      return arg
    }

    if (eqIndex === -1) {
      return `--${internalName}`
    }
    return `--${internalName}=${raw.slice(eqIndex + 1)}`
  })
}

export type ExtractSelectorInputRoutes = {
  media: boolean
  document: boolean
}

export type ExtractPublicSelectorTarget = {
  stt?: string
  ocr?: string
}

export const EXTRACT_PUBLIC_SELECTOR_FLAGS: Record<string, ExtractPublicSelectorTarget> = {
  reverb: { stt: 'reverb-stt' },
  gcloud: { stt: 'gcloud-stt', ocr: 'gcloud-docai' },
  aws: { stt: 'aws-stt', ocr: 'aws-textract' },
  deepinfra: { stt: 'deepinfra-stt', ocr: 'deepinfra-ocr' },
  deapi: { stt: 'deapi-stt' },
  elevenlabs: { stt: 'elevenlabs-stt' },
  deepgram: { stt: 'deepgram-stt' },
  soniox: { stt: 'soniox-stt' },
  speechmatics: { stt: 'speechmatics-stt' },
  rev: { stt: 'rev-stt' },
  groq: { stt: 'groq-stt' },
  grok: { stt: 'grok-stt' },
  mistral: { stt: 'mistral-stt', ocr: 'mistral-ocr' },
  assemblyai: { stt: 'assemblyai-stt' },
  gladia: { stt: 'gladia-stt' },
  happyscribe: { stt: 'happyscribe-stt' },
  supadata: { stt: 'supadata-stt' },
  scrapecreators: { stt: 'scrapecreators-stt' },
  openai: { stt: 'openai-stt', ocr: 'openai-ocr' },
  gemini: { stt: 'gemini-stt', ocr: 'gemini-ocr' },
  glm: { stt: 'glm-stt', ocr: 'glm-ocr' },
  together: { stt: 'together-stt' },
  whisper: { stt: 'whisper-stt' },
  tesseract: { ocr: 'tesseract-ocr' },
  ocrmypdf: { ocr: 'ocrmypdf' },
  paddle: { ocr: 'paddle-ocr' },
  kimi: { ocr: 'kimi-ocr' },
  anthropic: { ocr: 'anthropic-ocr' }
} as const

const extractPublicSelectorNames = new Set(Object.keys(EXTRACT_PUBLIC_SELECTOR_FLAGS))

export const hasExtractPublicSelectorFlags = (
  flags: Record<string, unknown>
): boolean =>
  Object.keys(flags).some((name) => extractPublicSelectorNames.has(name) && occurrenceValues(flags[name]).length > 0)

export const stripExtractPublicSelectorFlags = (
  flags: Record<string, unknown>
): Record<string, unknown> => {
  const stripped = { ...flags }
  for (const name of extractPublicSelectorNames) {
    delete stripped[name]
  }
  return stripped
}

export const expandExtractPublicSelectorExplicitFlags = (
  explicitFlags: Set<string>
): Set<string> => {
  const expanded = new Set(explicitFlags)
  for (const [publicName, target] of Object.entries(EXTRACT_PUBLIC_SELECTOR_FLAGS)) {
    if (!expanded.has(publicName)) {
      continue
    }
    if (target.stt) expanded.add(target.stt)
    if (target.ocr) expanded.add(target.ocr)
  }
  return expanded
}

const describeRoutes = (routes: ExtractSelectorInputRoutes): string => {
  if (routes.media && routes.document) return 'mixed media and document/image'
  if (routes.media) return 'media'
  if (routes.document) return 'document/image'
  return 'article, X Space, or unsupported'
}

const selectExtractTargets = (
  publicName: string,
  value: string | boolean,
  routes: ExtractSelectorInputRoutes
): string[] => {
  const target = EXTRACT_PUBLIC_SELECTOR_FLAGS[publicName as keyof typeof EXTRACT_PUBLIC_SELECTOR_FLAGS]
  if (!target) {
    return []
  }

  const targets: string[] = []
  if (routes.media && target.stt) targets.push(target.stt)
  if (routes.document && target.ocr) targets.push(target.ocr)

  if (targets.length === 0) {
    throw CLIUsageError(`--${publicName} does not apply to ${describeRoutes(routes)} extract inputs.`)
  }

  if (typeof value === 'string' && targets.length > 1) {
    throw CLIUsageError(
      `--${publicName} <model> is ambiguous for ${describeRoutes(routes)} extract inputs. Split the batch by input type or omit the model to use route-specific defaults.`
    )
  }

  return targets
}

export const normalizeExtractPublicSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  routes: ExtractSelectorInputRoutes
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = expandExtractPublicSelectorExplicitFlags(explicitFlags)

  for (const publicName of extractPublicSelectorNames) {
    const values = occurrenceValues(normalizedFlags[publicName])
    if (values.length === 0) {
      continue
    }

    delete normalizedFlags[publicName]
    for (const value of values) {
      for (const target of selectExtractTargets(publicName, value, routes)) {
        appendFlagValue(normalizedFlags, target, value)
      }
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}
