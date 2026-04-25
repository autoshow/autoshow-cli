import { join, relative, resolve as resolvePath } from 'node:path'
import type { BatchManifestEntry, ExtractBatchManifest, RuntimeOptions, OcrTarget, SttTarget } from '~/types'
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
  kind: 'stt' | 'ocr',
  relativeDir?: string | undefined
): ResumeTarget | undefined => {
  const childDir = resolvePath(parentDir, relativeDir ?? kind)
  return {
    kind,
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

  for (const childKind of ['stt', 'ocr'] as const) {
    const childRelativeDir = manifest.childBatches[childKind]
    if (typeof childRelativeDir !== 'string' || childRelativeDir.length === 0) {
      continue
    }

    const childDir = resolvePath(parentDir, childRelativeDir)
    const childManifest = await readBatchManifest(childDir, childKind)
    const childEntries = childManifest?.manifest.items ?? []

    nextItems.forEach((item, index) => {
      if (item.childBatchEntry?.kind !== childKind) {
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

const sttResumeHandler: ResumeHandler = {
  kind: 'stt',
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

const ocrResumeHandler: ResumeHandler = {
  kind: 'ocr',
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

const extractResumeHandler: ResumeHandler = {
  kind: 'extract',
  hasResumableWork: async (target, opts, explicitFlags) => {
    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return false
    }

    const childTargets = resolveExtractChildTargets(opts)
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'stt', manifest.manifest.childBatches.stt)
      const sttHandler = sttTarget ? getResumeHandler('stt') : undefined
      if (sttTarget && sttHandler && await sttHandler.hasResumableWork(sttTarget, opts, explicitFlags)) {
        return true
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'ocr', manifest.manifest.childBatches.ocr)
      const ocrHandler = ocrTarget ? getResumeHandler('ocr') : undefined
      if (ocrTarget && ocrHandler && await ocrHandler.hasResumableWork(ocrTarget, opts, explicitFlags)) {
        return true
      }
    }

    return false
  },
  resume: async (target, opts, explicitFlags) => {
    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return
    }

    const childTargets = resolveExtractChildTargets(opts)
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'stt', manifest.manifest.childBatches.stt)
      const sttHandler = sttTarget ? getResumeHandler('stt') : undefined
      if (sttTarget && sttHandler) {
        await sttHandler.resume(sttTarget, opts, explicitFlags)
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'ocr', manifest.manifest.childBatches.ocr)
      const ocrHandler = ocrTarget ? getResumeHandler('ocr') : undefined
      if (ocrTarget && ocrHandler) {
        await ocrHandler.resume(ocrTarget, opts, explicitFlags)
      }
    }

    await syncExtractBatchManifest(target.dir, manifest.manifest)
  }
}

const ttsResumeHandler: ResumeHandler = {
  kind: 'tts',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableTtsWork(target, opts),
  resume: async (target, opts, _explicitFlags) =>
    await resumeTtsTarget(target, opts)
}

const imageResumeHandler: ResumeHandler = {
  kind: 'image',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableImageWork(target, opts),
  resume: async (target, opts, _explicitFlags) =>
    await resumeImageTarget(target, opts)
}

const videoResumeHandler: ResumeHandler = {
  kind: 'video',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableVideoWork(target, opts),
  resume: async (target, opts, _explicitFlags) =>
    await resumeVideoTarget(target, opts)
}

const musicResumeHandler: ResumeHandler = {
  kind: 'music',
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableMusicWork(target, opts),
  resume: async (target, opts, _explicitFlags) =>
    await resumeMusicTarget(target, opts)
}

const RESUME_HANDLERS: Readonly<Record<ResumeTargetKind, ResumeHandler>> = {
  stt: sttResumeHandler,
  ocr: ocrResumeHandler,
  extract: extractResumeHandler,
  tts: ttsResumeHandler,
  image: imageResumeHandler,
  video: videoResumeHandler,
  music: musicResumeHandler
}

export const getResumeHandler = (
  kind: ResumeTarget['kind']
): ResumeHandler | undefined => RESUME_HANDLERS[kind]

export const getResumeHandlers = (): ResumeHandler[] => Object.values(RESUME_HANDLERS)
