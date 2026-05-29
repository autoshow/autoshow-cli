import { CLIUsageError } from '~/utils/error-handler'
import { URL_ARTICLE_BACKENDS } from './step-2-extract/step-2-url/url-provider-registry'

type SelectorFlagMap = Record<string, string>

type SelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  rawArgs?: string[] | undefined
}

const occurrenceValues = (value: unknown): Array<string | true> => {
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

const setBooleanFlag = (
  flags: Record<string, unknown>,
  flagName: string
): void => {
  flags[flagName] = true
}

const parseProviderSelectorValue = (
  rawValue: string | true,
  flagName: string
): { provider: string, model: string | true } => {
  if (rawValue === true) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  const eqIndex = trimmed.indexOf('=')
  const provider = (eqIndex === -1 ? trimmed : trimmed.slice(0, eqIndex)).trim().toLowerCase()
  if (provider.length === 0) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  if (eqIndex === -1) {
    return { provider, model: true }
  }

  const model = trimmed.slice(eqIndex + 1).trim()
  if (model.length === 0) {
    throw CLIUsageError(`--${flagName} requires a model after "${provider}=".`)
  }

  return { provider, model }
}

const normalizeProviderAliases = (provider: string): string => {
  switch (provider) {
    case 'paddle':
      return 'paddle-ocr'
    default:
      return provider
  }
}

const appendProviderSelector = (
  flags: Record<string, unknown>,
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>,
  value: string | true
): string => {
  const parsed = parseProviderSelectorValue(value, selectorFlag)
  const provider = normalizeProviderAliases(parsed.provider)
  const target = targetByProvider[provider]
  if (!target) {
    throw CLIUsageError(`Unknown provider "${parsed.provider}" for --${selectorFlag}.`)
  }

  if (parsed.model !== true && booleanTargets.has(target)) {
    throw CLIUsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }

  appendFlagValue(flags, target, parsed.model)
  return target
}

const selectorArgToInternalArgs = (
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>,
  value: string | true
): string[] => {
  const parsed = parseProviderSelectorValue(value, selectorFlag)
  const provider = normalizeProviderAliases(parsed.provider)
  const target = targetByProvider[provider]
  if (!target) {
    throw CLIUsageError(`Unknown provider "${parsed.provider}" for --${selectorFlag}.`)
  }
  if (parsed.model !== true && booleanTargets.has(target)) {
    throw CLIUsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }
  return parsed.model === true ? [`--${target}`] : [`--${target}`, parsed.model]
}

const normalizeProviderSelectorArgs = (
  argv: string[],
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>
): string[] => {
  const normalized: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      normalized.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || parsed.name !== selectorFlag) {
      normalized.push(arg)
      continue
    }

    const hasSeparateValue = parsed.inlineValue === undefined
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    const rawValue: string | true = parsed.inlineValue !== undefined
      ? parsed.inlineValue
      : hasSeparateValue
        ? argv[i + 1] as string
        : true

    if (hasSeparateValue) {
      i++
    }
    normalized.push(...selectorArgToInternalArgs(selectorFlag, targetByProvider, booleanTargets, rawValue))
  }

  return normalized
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

export const STANDALONE_TTS_PROVIDER_TARGETS = {
  kitten: 'kitten-tts',
  elevenlabs: 'elevenlabs-tts',
  minimax: 'minimax-tts',
  groq: 'groq-tts',
  grok: 'grok-tts',
  mistral: 'mistral-tts',
  openai: 'openai-tts',
  gemini: 'gemini-tts',
  deepgram: 'deepgram-tts',
  speechify: 'speechify-tts',
  hume: 'hume-tts',
  cartesia: 'cartesia-tts'
} as const satisfies Record<string, string>

export const STANDALONE_IMAGE_PROVIDER_TARGETS = {
  gemini: 'gemini-image',
  openai: 'openai-image',
  grok: 'grok-image',
  bfl: 'bfl-image',
  reve: 'reve-image'
} as const satisfies Record<string, string>

export const STANDALONE_VIDEO_PROVIDER_TARGETS = {
  gemini: 'gemini-video',
  minimax: 'minimax-video',
  glm: 'glm-video',
  grok: 'grok-video',
  runway: 'runway-video'
} as const satisfies Record<string, string>

export const STANDALONE_MUSIC_PROVIDER_TARGETS = {
  elevenlabs: 'elevenlabs-music',
  minimax: 'minimax-music',
  gemini: 'gemini-music'
} as const satisfies Record<string, string>

const WRITE_STT_PROVIDER_TARGETS = {
  reverb: 'reverb-stt',
  deepinfra: 'deepinfra-stt',
  elevenlabs: 'elevenlabs-stt',
  deepgram: 'deepgram-stt',
  soniox: 'soniox-stt',
  speechmatics: 'speechmatics-stt',
  rev: 'rev-stt',
  groq: 'groq-stt',
  grok: 'grok-stt',
  mistral: 'mistral-stt',
  assemblyai: 'assemblyai-stt',
  gladia: 'gladia-stt',
  happyscribe: 'happyscribe-stt',
  supadata: 'supadata-stt',
  scrapecreators: 'scrapecreators-stt',
  openai: 'openai-stt',
  gemini: 'gemini-stt',
  glm: 'glm-stt',
  together: 'together-stt',
  whisper: 'whisper-stt'
} as const satisfies Record<string, string>

const WRITE_OCR_PROVIDER_TARGETS = {
  tesseract: 'tesseract-ocr',
  ocrmypdf: 'ocrmypdf',
  'paddle-ocr': 'paddle-ocr',
  mistral: 'mistral-ocr',
  glm: 'glm-ocr',
  kimi: 'kimi-ocr',
  openai: 'openai-ocr',
  grok: 'grok-ocr',
  anthropic: 'anthropic-ocr',
  gemini: 'gemini-ocr',
  deepinfra: 'deepinfra-ocr',
  unstructured: 'unstructured-ocr'
} as const satisfies Record<string, string>

const WRITE_LLM_PROVIDER_TARGETS = {
  llama: 'llama',
  openai: 'openai',
  groq: 'groq',
  gemini: 'gemini',
  anthropic: 'anthropic',
  minimax: 'minimax',
  grok: 'grok',
  glm: 'glm',
  kimi: 'kimi'
} as const satisfies Record<string, string>

const BOOLEAN_PROVIDER_TARGETS = new Set<string>([
  'reverb-stt',
  'tesseract-ocr',
  'ocrmypdf',
  'paddle-ocr'
])

export const normalizeGenericProviderSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  options: {
    allProvidersTarget?: string | undefined
    rawArgs?: string[] | undefined
  } = {}
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  const values = occurrenceValues(normalizedFlags[selectorFlag])
  if (values.length > 0) {
    delete normalizedFlags[selectorFlag]
    normalizedExplicitFlags.delete(selectorFlag)
    for (const value of values) {
      normalizedExplicitFlags.add(
        appendProviderSelector(normalizedFlags, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS, value)
      )
    }
  }

  if (options.allProvidersTarget && normalizedFlags['all-providers'] === true) {
    delete normalizedFlags['all-providers']
    normalizedExplicitFlags.delete('all-providers')
    normalizedExplicitFlags.add(options.allProvidersTarget)
    setBooleanFlag(normalizedFlags, options.allProvidersTarget)
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags,
    rawArgs: options.rawArgs
      ? normalizeProviderSelectorArgs(options.rawArgs, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS).map((arg) =>
          arg === '--all-providers' && options.allProvidersTarget ? `--${options.allProvidersTarget}` : arg
        )
      : undefined
  }
}

const writeSelectorTargetsByFlag = {
  stt: WRITE_STT_PROVIDER_TARGETS,
  ocr: WRITE_OCR_PROVIDER_TARGETS,
  llm: WRITE_LLM_PROVIDER_TARGETS,
  tts: STANDALONE_TTS_PROVIDER_TARGETS,
  image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  video: STANDALONE_VIDEO_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS
} as const satisfies Record<string, Record<string, string>>

const writeAllProvidersTargets = {
  stt: 'all-stt',
  ocr: 'all-ocr',
  url: 'all-url',
  llm: 'all-llm',
  tts: 'all-tts',
  image: 'all-image',
  video: 'all-video',
  music: 'all-music'
} as const satisfies Record<string, string>

export const normalizeWriteStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawArgs?: string[] | undefined
): SelectorNormalizationResult => {
  let normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)
  let normalizedArgs = rawArgs ? [...rawArgs] : undefined

  for (const [selectorFlag, targetByProvider] of Object.entries(writeSelectorTargetsByFlag)) {
    const values = occurrenceValues(normalizedFlags[selectorFlag])
    if (values.length === 0) {
      continue
    }
    delete normalizedFlags[selectorFlag]
    normalizedExplicitFlags.delete(selectorFlag)
    for (const value of values) {
      normalizedExplicitFlags.add(
        appendProviderSelector(normalizedFlags, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS, value)
      )
    }
    if (normalizedArgs) {
      normalizedArgs = normalizeProviderSelectorArgs(normalizedArgs, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS)
    }
  }

  for (const value of occurrenceValues(normalizedFlags['all-providers'])) {
    if (value === true) {
      throw CLIUsageError('--all-providers requires a step: stt, ocr, url, llm, tts, image, video, or music.')
    }
    const step = value.trim().toLowerCase()
    const target = writeAllProvidersTargets[step as keyof typeof writeAllProvidersTargets]
    if (!target) {
      throw CLIUsageError(`Invalid --all-providers step "${value}". Expected stt, ocr, url, llm, tts, image, video, or music.`)
    }
    setBooleanFlag(normalizedFlags, target)
    normalizedExplicitFlags.add(target)
  }
  delete normalizedFlags['all-providers']
  normalizedExplicitFlags.delete('all-providers')

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags,
    rawArgs: normalizedArgs
  }
}

const TTS_PROVIDER_BY_TARGET = Object.fromEntries(
  Object.entries(STANDALONE_TTS_PROVIDER_TARGETS).map(([provider, target]) => [target, provider])
) as Record<string, string>

const TTS_GENERIC_OPTION_TARGETS = {
  'tts-voice': {
    kitten: 'kitten-voice',
    groq: 'groq-voice',
    grok: 'grok-tts-voice',
    mistral: 'mistral-tts-voice',
    openai: 'openai-voice',
    gemini: 'gemini-voice',
    deepgram: 'deepgram-voice',
    speechify: 'speechify-voice',
    hume: 'hume-tts-voice',
    cartesia: 'cartesia-tts-voice',
    minimax: 'minimax-tts-voice',
    elevenlabs: 'elevenlabs-voice'
  },
  'tts-speed': {
    openai: 'openai-tts-speed',
    deepgram: 'deepgram-tts-speed',
    minimax: 'minimax-tts-speed',
    elevenlabs: 'elevenlabs-tts-speed'
  },
  'tts-language': {
    grok: 'grok-tts-language',
    speechify: 'speechify-tts-language',
    cartesia: 'cartesia-tts-language',
    elevenlabs: 'elevenlabs-tts-language-code'
  },
  'tts-ref-audio': {
    mistral: 'mistral-tts-ref-audio',
    openai: 'openai-tts-ref-audio',
    speechify: 'speechify-tts-ref-audio',
    elevenlabs: 'elevenlabs-tts-ref-audio'
  },
  'tts-voice-name': {
    mistral: 'mistral-tts-voice-name',
    openai: 'openai-tts-voice-name',
    speechify: 'speechify-tts-voice-name',
    elevenlabs: 'elevenlabs-tts-voice-name'
  },
  'tts-consent-audio': {
    openai: 'openai-tts-consent-audio'
  },
  'tts-consent-language': {
    openai: 'openai-tts-consent-language'
  },
  'tts-consent-name': {
    openai: 'openai-tts-consent-name',
    speechify: 'speechify-tts-consent-name'
  },
  'tts-consent-email': {
    speechify: 'speechify-tts-consent-email'
  },
  'tts-text-normalization': {
    grok: 'grok-tts-text-normalization',
    minimax: 'minimax-tts-english-normalization',
    elevenlabs: 'elevenlabs-tts-text-normalization'
  },
  'tts-instructions': {
    openai: 'openai-tts-instructions'
  },
  'tts-output-format': {
    deepgram: 'deepgram-tts-encoding',
    speechify: 'speechify-tts-audio-format',
    elevenlabs: 'elevenlabs-tts-output-format'
  }
} as const satisfies Record<string, Record<string, string>>

const genericTtsOptionFlags = Object.keys(TTS_GENERIC_OPTION_TARGETS)
const booleanTtsOptionTargets = new Set<string>(['grok-tts-text-normalization', 'minimax-tts-english-normalization'])

const readSelectedTtsProviders = (
  flags: Record<string, unknown>,
  defaultProvider?: string | undefined
): string[] => {
  if (flags['all-tts'] === true) {
    return Object.keys(STANDALONE_TTS_PROVIDER_TARGETS)
  }

  const providers: string[] = []
  for (const [target, provider] of Object.entries(TTS_PROVIDER_BY_TARGET)) {
    if (occurrenceValues(flags[target]).length > 0) {
      providers.push(provider)
    }
  }

  if (providers.length === 0 && defaultProvider) {
    providers.push(defaultProvider)
  }

  return providers
}

const parseGenericTtsOptionValue = (
  rawValue: string | true,
  flagName: string
): { provider?: string | undefined, value: string | boolean } => {
  if (rawValue === true) {
    return { value: true }
  }

  const eqIndex = rawValue.indexOf('=')
  if (eqIndex > 0) {
    const possibleProvider = normalizeProviderAliases(rawValue.slice(0, eqIndex).trim().toLowerCase())
    if (possibleProvider in STANDALONE_TTS_PROVIDER_TARGETS) {
      const value = rawValue.slice(eqIndex + 1)
      if (value.length === 0) {
        throw CLIUsageError(`--${flagName} requires a value after "${possibleProvider}=".`)
      }
      return { provider: possibleProvider, value }
    }
  }

  return { value: rawValue }
}

const resolveGenericTtsOptionProvider = (
  flagName: string,
  parsedProvider: string | undefined,
  selectedProviders: string[]
): string => {
  if (parsedProvider) {
    return parsedProvider
  }
  if (selectedProviders.length === 1) {
    return selectedProviders[0] as string
  }
  if (selectedProviders.length === 0) {
    throw CLIUsageError(`--${flagName} requires one selected TTS provider or provider=value.`)
  }
  throw CLIUsageError(`--${flagName} requires provider=value when multiple TTS providers are selected.`)
}

const appendGenericTtsOption = (
  flags: Record<string, unknown>,
  flagName: string,
  provider: string,
  value: string | boolean
): string => {
  const providerTargets = TTS_GENERIC_OPTION_TARGETS[flagName as keyof typeof TTS_GENERIC_OPTION_TARGETS]
  const target = providerTargets?.[provider as keyof typeof providerTargets]
  if (!target) {
    throw CLIUsageError(`--${flagName} does not apply to ${provider} TTS.`)
  }

  if (booleanTtsOptionTargets.has(target)) {
    flags[target] = value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()))
    return target
  }

  if (value === true) {
    throw CLIUsageError(`--${flagName} requires a value.`)
  }

  appendFlagValue(flags, target, value)
  return target
}

export const normalizeGenericTtsOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  defaultProvider?: string | undefined
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)
  const selectedProviders = readSelectedTtsProviders(normalizedFlags, defaultProvider)

  for (const flagName of genericTtsOptionFlags) {
    const values = occurrenceValues(normalizedFlags[flagName])
    if (values.length === 0) {
      continue
    }

    delete normalizedFlags[flagName]
    normalizedExplicitFlags.delete(flagName)
    for (const value of values) {
      const parsed = parseGenericTtsOptionValue(value, flagName)
      const provider = resolveGenericTtsOptionProvider(flagName, parsed.provider, selectedProviders)
      normalizedExplicitFlags.add(appendGenericTtsOption(normalizedFlags, flagName, provider, parsed.value))
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}

export type ExtractSelectorInputRoutes = {
  media: boolean
  document: boolean
  article?: boolean | undefined
}

type ExtractPublicSelectorTarget = {
  stt?: string
  ocr?: string
}

export const EXTRACT_PUBLIC_SELECTOR_FLAGS: Record<string, ExtractPublicSelectorTarget> = {
  reverb: { stt: 'reverb-stt' },
  deepinfra: { stt: 'deepinfra-stt', ocr: 'deepinfra-ocr' },
  elevenlabs: { stt: 'elevenlabs-stt' },
  deepgram: { stt: 'deepgram-stt' },
  soniox: { stt: 'soniox-stt' },
  speechmatics: { stt: 'speechmatics-stt' },
  rev: { stt: 'rev-stt' },
  groq: { stt: 'groq-stt' },
  grok: { stt: 'grok-stt', ocr: 'grok-ocr' },
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
  'paddle-ocr': { ocr: 'paddle-ocr' },
  kimi: { ocr: 'kimi-ocr' },
  anthropic: { ocr: 'anthropic-ocr' },
  unstructured: { ocr: 'unstructured-ocr' }
} as const

const extractBooleanSelectorTargetFlags = new Set(['reverb-stt', 'tesseract-ocr', 'ocrmypdf', 'paddle-ocr'])

const parseLongFlagArg = (arg: string): { name: string, inlineValue?: string } | undefined => {
  if (!arg.startsWith('--') || arg === '--') {
    return undefined
  }

  const raw = arg.slice(2)
  const eqIndex = raw.indexOf('=')
  return eqIndex === -1
    ? { name: raw }
    : { name: raw.slice(0, eqIndex), inlineValue: raw.slice(eqIndex + 1) }
}

const extractUrlProviderNames = new Set<string>(URL_ARTICLE_BACKENDS)

const selectExtractGenericTargets = (
  rawProviderName: string,
  value: string | boolean,
  routes: ExtractSelectorInputRoutes
): Array<{ target: string, value: string | boolean }> => {
  const providerName = normalizeProviderAliases(rawProviderName)
  const targets: Array<{ target: string, value: string | boolean }> = []
  const target = EXTRACT_PUBLIC_SELECTOR_FLAGS[providerName as keyof typeof EXTRACT_PUBLIC_SELECTOR_FLAGS]

  if (routes.media && target?.stt) {
    targets.push({ target: target.stt, value })
  }
  if (routes.document && target?.ocr) {
    targets.push({ target: target.ocr, value })
  }

  if (routes.article && extractUrlProviderNames.has(providerName)) {
    if (value !== true) {
      throw CLIUsageError(`--provider ${rawProviderName} does not accept a model for article extract inputs.`)
    }
    targets.push({ target: 'url-provider', value: providerName })
  }

  if (targets.length === 0) {
    throw CLIUsageError(`--provider ${rawProviderName} does not apply to ${describeRoutes(routes)} extract inputs.`)
  }

  const selectedModelTargets = targets.filter((entry) =>
    entry.target !== 'url-provider' && !extractBooleanSelectorTargetFlags.has(entry.target)
  )
  if (typeof value === 'string' && selectedModelTargets.length > 1) {
    throw CLIUsageError(
      `--provider ${rawProviderName}=<model> is ambiguous for ${describeRoutes(routes)} extract inputs. Split the batch by input type or omit the model to use route-specific defaults.`
    )
  }

  for (const entry of targets) {
    if (typeof value === 'string' && extractBooleanSelectorTargetFlags.has(entry.target)) {
      throw CLIUsageError(`--provider ${rawProviderName} does not accept a model for ${describeRoutes(routes)} extract inputs.`)
    }
  }

  return targets
}

const selectExtractAllProviderTargets = (
  routes: ExtractSelectorInputRoutes
): string[] => {
  const targets: string[] = []
  if (routes.media) targets.push('all-stt')
  if (routes.document) targets.push('all-ocr')
  if (routes.article) targets.push('all-url')
  if (targets.length === 0) {
    throw CLIUsageError(`--all-providers does not apply to ${describeRoutes(routes)} extract inputs.`)
  }
  return targets
}

const appendExtractGenericTarget = (
  flags: Record<string, unknown>,
  target: string,
  value: string | boolean
): void => {
  if (target === 'url-provider') {
    const current = flags[target]
    if (typeof current === 'string' && current !== value) {
      throw CLIUsageError('Article extract supports one --provider URL backend at a time. Use --all-providers for all URL providers.')
    }
    flags[target] = value
    return
  }
  appendFlagValue(flags, target, value)
}

export const hasExtractGenericSelectorFlags = (
  flags: Record<string, unknown>
): boolean =>
  occurrenceValues(flags['provider']).length > 0 || flags['all-providers'] === true

export const stripExtractGenericSelectorFlags = (
  flags: Record<string, unknown>
): Record<string, unknown> => {
  const stripped = { ...flags }
  delete stripped['provider']
  delete stripped['all-providers']
  return stripped
}

export const stripExtractGenericSelectorArgs = (argv: string[]): string[] => {
  const stripped: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      stripped.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || (parsed.name !== 'provider' && parsed.name !== 'all-providers')) {
      stripped.push(arg)
      continue
    }

    if (
      parsed.name === 'provider'
      && parsed.inlineValue === undefined
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    ) {
      i++
    }
  }

  return stripped
}

export const normalizeExtractGenericSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  routes: ExtractSelectorInputRoutes
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  for (const value of occurrenceValues(normalizedFlags['provider'])) {
    const parsed = parseProviderSelectorValue(value, 'provider')
    for (const target of selectExtractGenericTargets(parsed.provider, parsed.model, routes)) {
      appendExtractGenericTarget(normalizedFlags, target.target, target.value)
      normalizedExplicitFlags.add(target.target)
    }
  }
  delete normalizedFlags['provider']
  normalizedExplicitFlags.delete('provider')

  if (normalizedFlags['all-providers'] === true) {
    for (const target of selectExtractAllProviderTargets(routes)) {
      setBooleanFlag(normalizedFlags, target)
      normalizedExplicitFlags.add(target)
    }
    delete normalizedFlags['all-providers']
    normalizedExplicitFlags.delete('all-providers')
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}

export const normalizeExtractGenericSelectorArgs = (
  argv: string[],
  routes: ExtractSelectorInputRoutes
): string[] => {
  const normalized: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      normalized.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || (parsed.name !== 'provider' && parsed.name !== 'all-providers')) {
      normalized.push(arg)
      continue
    }

    if (parsed.name === 'all-providers') {
      normalized.push(...selectExtractAllProviderTargets(routes).map((target) => `--${target}`))
      continue
    }

    const hasSeparateValue = parsed.inlineValue === undefined
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    const rawValue: string | true = parsed.inlineValue !== undefined
      ? parsed.inlineValue
      : hasSeparateValue
        ? argv[i + 1] as string
        : true
    if (hasSeparateValue) {
      i++
    }

    const provider = parseProviderSelectorValue(rawValue, 'provider')
    for (const target of selectExtractGenericTargets(provider.provider, provider.model, routes)) {
      if (target.target === 'url-provider') {
        normalized.push('--url-provider', String(target.value))
      } else if (typeof target.value === 'string' && !extractBooleanSelectorTargetFlags.has(target.target)) {
        normalized.push(`--${target.target}`, target.value)
      } else {
        normalized.push(`--${target.target}`)
      }
    }
  }

  return normalized
}

const describeRoutes = (routes: ExtractSelectorInputRoutes): string => {
  if (routes.media && routes.document) return 'mixed media and document/image'
  if (routes.media) return 'media'
  if (routes.document) return 'document/image'
  return 'article, X Space, or unsupported'
}

export const normalizeLegacyMultiSpeakerFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  const s1Name = typeof normalizedFlags['gemini-speaker-1-name'] === 'string' ? normalizedFlags['gemini-speaker-1-name'].trim() : ''
  const s1Voice = typeof normalizedFlags['gemini-speaker-1-voice'] === 'string' ? normalizedFlags['gemini-speaker-1-voice'].trim() : ''
  const s2Name = typeof normalizedFlags['gemini-speaker-2-name'] === 'string' ? normalizedFlags['gemini-speaker-2-name'].trim() : ''
  const s2Voice = typeof normalizedFlags['gemini-speaker-2-voice'] === 'string' ? normalizedFlags['gemini-speaker-2-voice'].trim() : ''

  if (s1Name && s1Voice && s2Name && s2Voice) {
    appendFlagValue(normalizedFlags, 'tts-speaker', `${s1Name}=${s1Voice}`)
    appendFlagValue(normalizedFlags, 'tts-speaker', `${s2Name}=${s2Voice}`)
    if (
      typeof normalizedFlags['tts-dialogue-format'] !== 'string'
      || normalizedFlags['tts-dialogue-format'].trim().length === 0
    ) {
      normalizedFlags['tts-dialogue-format'] = 'labeled'
    }
    normalizedExplicitFlags.add('tts-speaker')
  }

  const refAudios = occurrenceValues(normalizedFlags['tts-speaker-ref-audio'])
  for (const value of refAudios) {
    if (typeof value === 'string') {
      appendFlagValue(normalizedFlags, 'tts-speaker', value)
      normalizedExplicitFlags.add('tts-speaker')
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}
