import { join, resolve as resolvePath } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { readBatchManifest, readExtractBatchManifest, readRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import {
  extractExplicitFlags,
  mergeConfigIntoRawFlags
} from '~/cli/commands/setup-and-utilities/config/config-merge'
import {
  loadConfig,
  resolveConfigPath
} from '~/cli/commands/setup-and-utilities/config/config-loader'
import type { BatchManifest, ExtractRoute, RunManifest } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getResumeHandler } from './resume-registry'
import type { ResumeTarget, ResumeTargetKind } from '~/types'
import {
  EXTRACT_PUBLIC_SELECTOR_FLAGS,
  normalizeExtractGenericSelectorArgs,
  normalizeExtractGenericSelectorFlags,
  normalizeGenericProviderSelectorFlags,
  normalizeGenericTtsOptionFlags,
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  type ExtractSelectorInputRoutes,
} from '~/cli/commands/process-steps/service-selector-normalization'
import { TTS_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/tts-flags'
import { IMAGE_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/image-flags'
import { VIDEO_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/video-flags'
import { MUSIC_COMMAND_SELECTOR_FLAGS } from '~/cli/flags/music-flags'
import { getStep2ProviderSelectionFlagNames } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const SUPPORTED_RESUME_KINDS = new Set<ResumeTargetKind>(['extract', 'tts', 'image', 'video', 'music'])

const STT_SELECTION_FLAGS = getStep2ProviderSelectionFlagNames('stt')
const OCR_SELECTION_FLAGS = getStep2ProviderSelectionFlagNames('ocr')

const EXTRACT_SELECTOR_FLAGS = [
  'all-stt',
  'all-ocr',
  ...STT_SELECTION_FLAGS,
  ...OCR_SELECTION_FLAGS
] as const

const TTS_SELECTOR_FLAGS = [
  'all-tts',
  ...Object.keys(TTS_COMMAND_SELECTOR_FLAGS)
] as const

const IMAGE_SELECTOR_FLAGS = [
  'all-image',
  ...Object.keys(IMAGE_COMMAND_SELECTOR_FLAGS)
] as const

const VIDEO_SELECTOR_FLAGS = [
  'all-video',
  ...Object.keys(VIDEO_COMMAND_SELECTOR_FLAGS)
] as const

const MUSIC_SELECTOR_FLAGS = [
  'all-music',
  ...Object.keys(MUSIC_COMMAND_SELECTOR_FLAGS)
] as const

const INTERNAL_SELECTOR_FLAGS_BY_KIND: Record<ResumeTargetKind, ReadonlySet<string>> = {
  extract: new Set(EXTRACT_SELECTOR_FLAGS),
  tts: new Set(TTS_SELECTOR_FLAGS),
  image: new Set(IMAGE_SELECTOR_FLAGS),
  video: new Set(VIDEO_SELECTOR_FLAGS),
  music: new Set(MUSIC_SELECTOR_FLAGS)
}

const PUBLIC_SELECTOR_FLAGS_BY_KIND: Record<ResumeTargetKind, ReadonlySet<string>> = {
  extract: new Set(Object.keys(EXTRACT_PUBLIC_SELECTOR_FLAGS)),
  tts: new Set(Object.values(TTS_COMMAND_SELECTOR_FLAGS)),
  image: new Set(Object.values(IMAGE_COMMAND_SELECTOR_FLAGS)),
  video: new Set(Object.values(VIDEO_COMMAND_SELECTOR_FLAGS)),
  music: new Set(Object.values(MUSIC_COMMAND_SELECTOR_FLAGS))
}

const ALL_INTERNAL_SELECTOR_FLAGS = new Set(
  Object.values(INTERNAL_SELECTOR_FLAGS_BY_KIND).flatMap((flags) => [...flags])
)
const ALL_PUBLIC_SELECTOR_FLAGS = new Set(
  Object.values(PUBLIC_SELECTOR_FLAGS_BY_KIND).flatMap((flags) => [...flags])
)

const PROVIDER_TARGETS_BY_KIND = {
  tts: STANDALONE_TTS_PROVIDER_TARGETS,
  image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  video: STANDALONE_VIDEO_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS
} as const satisfies Record<Exclude<ResumeTargetKind, 'extract'>, Record<string, string>>

const ALL_PROVIDERS_TARGET_BY_KIND = {
  tts: 'all-tts',
  image: 'all-image',
  video: 'all-video',
  music: 'all-music'
} as const satisfies Record<Exclude<ResumeTargetKind, 'extract'>, string>

type ResumeSelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  rawArgs: string[]
}

const occurrenceValues = (value: unknown): Array<string | boolean> => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string | true => typeof entry === 'string' || entry === true)
  }
  return typeof value === 'string' || value === true ? [value] : []
}

const explicitOrPresent = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagName: string
): boolean =>
  explicitFlags.has(flagName) || occurrenceValues(flags[flagName]).length > 0

const assertSelectorFlagsApplyToTarget = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
): void => {
  for (const flagName of ALL_INTERNAL_SELECTOR_FLAGS) {
    if (!explicitFlags.has(flagName)) {
      continue
    }
    throw CLIUsageError(`--${flagName} is no longer supported for resume. Use --provider provider[=model] or --all-providers.`)
  }

  for (const flagName of ALL_PUBLIC_SELECTOR_FLAGS) {
    if (!explicitOrPresent(flags, explicitFlags, flagName)) {
      continue
    }
    throw CLIUsageError(`--${flagName} is no longer supported for resume. Use --provider provider[=model] or --all-providers.`)
  }
}

const extractRoutesForTarget = (
  target: ResumeTarget
): ExtractSelectorInputRoutes => ({
  media: target.extractRoute === undefined || target.extractRoute === 'media',
  document: target.extractRoute === undefined || target.extractRoute === 'document',
  article: target.extractRoute === undefined || target.extractRoute === 'x-space'
})

const isExtractRoute = (value: unknown): value is ExtractRoute =>
  value === 'media' || value === 'document' || value === 'x-space'

const inferExtractRouteFromBatchManifest = (
  manifest: BatchManifest
): ExtractRoute | undefined => {
  if (manifest.kind !== 'extract') {
    return undefined
  }

  const routes = new Set<ExtractRoute>()
  for (const item of manifest.items) {
    if (isExtractRoute(item['extractRoute'])) {
      routes.add(item['extractRoute'])
    }
  }

  return routes.size === 1 ? [...routes][0] : undefined
}

const inferExtractRouteFromRunManifest = (
  manifest: RunManifest
): ExtractRoute | undefined =>
  manifest.kind === 'extract' && isExtractRoute(manifest.metadata['extractRoute'])
    ? manifest.metadata['extractRoute']
    : undefined

const toResumeTarget = (
  kind: string,
  scope: ResumeTarget['scope'],
  dir: string,
  manifestPath: string,
  extractRoute?: ExtractRoute | undefined
): ResumeTarget | undefined =>
  SUPPORTED_RESUME_KINDS.has(kind as ResumeTargetKind)
    ? {
        kind: kind as ResumeTargetKind,
        ...(extractRoute ? { extractRoute } : {}),
        scope,
        dir,
        manifestPath
      }
    : undefined

const resolveExplicitResumeTarget = async (
  outputDirInput: string
): Promise<ResumeTarget> => {
  const dir = resolvePath(outputDirInput)
  const extractBatchManifest = await readExtractBatchManifest(dir)
  if (extractBatchManifest) {
    return {
      kind: 'extract',
      scope: 'batch',
      dir,
      manifestPath: extractBatchManifest.manifestPath
    }
  }

  const batchManifest = await readBatchManifest(dir)
  if (batchManifest) {
    const target = toResumeTarget(
      batchManifest.manifest.kind,
      'batch',
      dir,
      batchManifest.manifestPath,
      inferExtractRouteFromBatchManifest(batchManifest.manifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, TTS, image, video, and music manifests. Found "${batchManifest.manifest.kind}" at ${batchManifest.manifestPath}.`)
  }

  const runManifest = await readRunManifest(dir)
  if (runManifest) {
    const target = toResumeTarget(
      runManifest.kind,
      'single',
      dir,
      join(dir, 'run.json'),
      inferExtractRouteFromRunManifest(runManifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, TTS, image, video, and music manifests. Found "${runManifest.kind}" at ${join(dir, 'run.json')}.`)
  }

  throw CLIUsageError(`Could not find extract-batch.json, batch.json, or run.json under ${dir}.`)
}

export const normalizeResumeSelectorFlagsForTarget = (
  target: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawArgs: string[]
): ResumeSelectorNormalizationResult => {
  assertSelectorFlagsApplyToTarget(flags, explicitFlags)

  if (target.kind === 'extract') {
    const routes = extractRoutesForTarget(target)
    const normalized = normalizeExtractGenericSelectorFlags(flags, explicitFlags, routes)
    return {
      ...normalized,
      rawArgs: normalizeExtractGenericSelectorArgs(rawArgs, routes)
    }
  }

  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    explicitFlags,
    'provider',
    PROVIDER_TARGETS_BY_KIND[target.kind],
    {
      allProvidersTarget: ALL_PROVIDERS_TARGET_BY_KIND[target.kind],
      rawArgs
    }
  )

  if (target.kind === 'tts') {
    const ttsNormalized = normalizeGenericTtsOptionFlags(
      providerNormalized.flags,
      providerNormalized.explicitFlags
    )
    return {
      flags: ttsNormalized.flags,
      explicitFlags: ttsNormalized.explicitFlags,
      rawArgs: providerNormalized.rawArgs ?? rawArgs
    }
  }

  return {
    flags: providerNormalized.flags,
    explicitFlags: providerNormalized.explicitFlags,
    rawArgs: providerNormalized.rawArgs ?? rawArgs
  }
}

export const dispatchResume = async (
  outputDirInput: string | undefined,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = [],
  rawArgv: string[] = Bun.argv.slice(2)
): Promise<void> => {
  if (doubleDash.length > 0) {
    throw CLIUsageError(`Unexpected positional outputs after "--" for "resume": ${doubleDash.join(' ')}. Run: bun as help resume`)
  }
  if (typeof outputDirInput !== 'string' || outputDirInput.trim().length === 0) {
    throw CLIUsageError('Missing required output directory. Usage: bun as resume <output-dir> [flags]')
  }

  const target = await resolveExplicitResumeTarget(outputDirInput)
  const rawExplicitFlags = extractExplicitFlags(rawArgv)
  const normalized = normalizeResumeSelectorFlagsForTarget(target, rawFlags, rawExplicitFlags, rawArgv)
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const mergedFlags = mergeConfigIntoRawFlags(normalized.flags, config, normalized.explicitFlags)
  const opts = {
    ...buildOptsFromFlags(false, mergedFlags, doubleDash, {}, normalized.explicitFlags, normalized.rawArgs),
    configPath: resolvedConfigPath
  }

  const handler = getResumeHandler(target.kind)
  if (!handler) {
    throw CLIUsageError(`Resume is not supported for "${target.kind}".`)
  }

  await handler.resume(target, opts, normalized.explicitFlags)
}
