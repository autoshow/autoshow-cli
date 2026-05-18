import { join, relative, resolve as resolvePath } from 'node:path'
import type { BatchManifestEntry, ExtractBatchManifest, ExtractRoute, RuntimeOptions, OcrTarget, SttTarget } from '~/types'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import {
  hasResumableOcrTargetWork,
  resumeOcrTarget
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/resume'
import {
  hasResumableSttTargetWork,
  resumeSttTarget
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/resume'
import { hasResumableTtsWork, resumeTtsTarget } from '~/cli/commands/process-steps/step-4-tts/resume'
import { hasResumableImageWork, resumeImageTarget } from '~/cli/commands/process-steps/step-5-image/resume'
import { hasResumableVideoWork, resumeVideoTarget } from '~/cli/commands/process-steps/step-6-video/resume'
import { hasResumableMusicWork, resumeMusicTarget } from '~/cli/commands/process-steps/step-7-music/resume'
import { readBatchManifest, readExtractBatchManifest, writeExtractBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import type { ResumeHandler, ResumeTarget, ResumeTargetKind } from '~/types'

type ExtractRouteResumeHandler = Pick<ResumeHandler, 'hasResumableWork' | 'resume'>

const EXPLICIT_STEP2_SELECTION_FILTER = {
  includeOrigins: ['explicit', 'all-shortcut']
} as const

const getSelectedSttTargets = (
  opts: RuntimeOptions
): SttTarget[] | undefined => {
  const targets = collectSttTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedOcrTargets = (
  opts: RuntimeOptions
): OcrTarget[] | undefined => {
  const targets = collectExplicitOcrTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const resolveExtractChildTargets = (
  opts: RuntimeOptions
): {
  sttTargets?: SttTarget[] | undefined
  ocrTargets?: OcrTarget[] | undefined
  shouldCheckStt: boolean
  shouldCheckOcr: boolean
} => {
  const sttTargets = getSelectedSttTargets(opts)
  const ocrTargets = getSelectedOcrTargets(opts)
  const shouldCheckStt = sttTargets !== undefined || ocrTargets === undefined
  const shouldCheckOcr = ocrTargets !== undefined || sttTargets === undefined

  return {
    ...(sttTargets ? { sttTargets } : {}),
    ...(ocrTargets ? { ocrTargets } : {}),
    shouldCheckStt,
    shouldCheckOcr
  }
}

const buildChildResumeTarget = (
  parentDir: string,
  route: ExtractRoute,
  relativeDir?: string | undefined
): ResumeTarget | undefined => {
  const childDir = resolvePath(parentDir, relativeDir ?? route)
  return {
    kind: 'extract',
    extractRoute: route,
    scope: 'batch',
    dir: childDir,
    manifestPath: join(childDir, 'batch.json')
  }
}

const isCompletionStatus = (
  value: unknown
): value is ExtractBatchManifest['items'][number]['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const toRelativeOutputDir = (
  parentDir: string,
  outputDir: unknown
): string | undefined => {
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    return undefined
  }

  const relativePath = relative(parentDir, outputDir)
  return relativePath.length > 0 ? relativePath : '.'
}

const syncExtractBatchManifest = async (
  parentDir: string,
  manifest: ExtractBatchManifest
): Promise<void> => {
  const nextItems = manifest.items.map((item) => ({ ...item }))

  for (const route of ['media', 'document'] as const) {
    const childRelativeDir = manifest.childBatches[route]
    if (typeof childRelativeDir !== 'string' || childRelativeDir.length === 0) {
      continue
    }

    const childDir = resolvePath(parentDir, childRelativeDir)
    const childManifest = await readBatchManifest(childDir, 'extract')
    const childEntries = childManifest?.manifest.items ?? []

    nextItems.forEach((item, index) => {
      if (item.childBatchEntry?.route !== route) {
        return
      }

      const childEntry = childEntries[item.childBatchEntry.index] as BatchManifestEntry | undefined
      if (!childEntry) {
        return
      }

      const outputDir = toRelativeOutputDir(parentDir, childEntry['outputDir'])
      nextItems[index] = {
        ...item,
        completionStatus: isCompletionStatus(childEntry['completionStatus'])
          ? childEntry['completionStatus']
          : item.completionStatus,
        ...(typeof childEntry['skipReason'] === 'string' ? { skipReason: childEntry['skipReason'] } : {}),
        ...(outputDir ? { outputDir } : {})
      }
    })
  }

  await writeExtractBatchManifest(parentDir, {
    ...manifest,
    items: nextItems
  })
}

const sttResumeHandler: ExtractRouteResumeHandler = {
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableSttTargetWork(
      target,
      getSelectedSttTargets(opts),
      {
        youtubeCaptions: opts.youtubeCaptions,
        currentTargets: collectSttTargets(opts)
      }
    ),
  resume: async (target, opts, _explicitFlags) =>
    await resumeSttTarget(
      target,
      opts,
      getSelectedSttTargets(opts)
    )
}

const ocrResumeHandler: ExtractRouteResumeHandler = {
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableOcrTargetWork(
      target,
      getSelectedOcrTargets(opts)
    ),
  resume: async (target, opts, _explicitFlags) =>
    await resumeOcrTarget(
      target,
      opts,
      getSelectedOcrTargets(opts)
    )
}

const getExtractRouteResumeHandler = (
  route: ExtractRoute | undefined
): ExtractRouteResumeHandler | undefined => {
  if (route === 'media') {
    return sttResumeHandler
  }
  if (route === 'document') {
    return ocrResumeHandler
  }
  return undefined
}

const extractResumeHandler: ResumeHandler = {
  kind: 'extract',
  hasResumableWork: async (target, opts, explicitFlags) => {
    const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
    if (routeHandler) {
      return await routeHandler.hasResumableWork(target, opts, explicitFlags)
    }

    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return false
    }

    const childTargets = resolveExtractChildTargets(opts)
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'media', manifest.manifest.childBatches.media)
      const sttHandler = getExtractRouteResumeHandler('media')
      if (sttTarget && sttHandler && await sttHandler.hasResumableWork(sttTarget, opts, explicitFlags)) {
        return true
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'document', manifest.manifest.childBatches.document)
      const ocrHandler = getExtractRouteResumeHandler('document')
      if (ocrTarget && ocrHandler && await ocrHandler.hasResumableWork(ocrTarget, opts, explicitFlags)) {
        return true
      }
    }

    return false
  },
  resume: async (target, opts, explicitFlags) => {
    const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
    if (routeHandler) {
      await routeHandler.resume(target, opts, explicitFlags)
      return
    }

    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return
    }

    const childTargets = resolveExtractChildTargets(opts)
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'media', manifest.manifest.childBatches.media)
      const sttHandler = getExtractRouteResumeHandler('media')
      if (sttTarget && sttHandler) {
        await sttHandler.resume(sttTarget, opts, explicitFlags)
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'document', manifest.manifest.childBatches.document)
      const ocrHandler = getExtractRouteResumeHandler('document')
      if (ocrTarget && ocrHandler) {
        await ocrHandler.resume(ocrTarget, opts, explicitFlags)
      }
    }

    await syncExtractBatchManifest(target.dir, manifest.manifest)
  }
}

const ttsResumeHandler: ResumeHandler = {
  kind: 'tts',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableTtsWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags) =>
    await resumeTtsTarget(target, opts, explicitFlags)
}

const imageResumeHandler: ResumeHandler = {
  kind: 'image',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableImageWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags) =>
    await resumeImageTarget(target, opts, explicitFlags)
}

const videoResumeHandler: ResumeHandler = {
  kind: 'video',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableVideoWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags) =>
    await resumeVideoTarget(target, opts, explicitFlags)
}

const musicResumeHandler: ResumeHandler = {
  kind: 'music',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableMusicWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags) =>
    await resumeMusicTarget(target, opts, explicitFlags)
}

const RESUME_HANDLERS: Readonly<Record<ResumeTargetKind, ResumeHandler>> = {
  extract: extractResumeHandler,
  tts: ttsResumeHandler,
  image: imageResumeHandler,
  video: videoResumeHandler,
  music: musicResumeHandler
}

export const getResumeHandler = (
  kind: ResumeTarget['kind']
): ResumeHandler | undefined => RESUME_HANDLERS[kind]
