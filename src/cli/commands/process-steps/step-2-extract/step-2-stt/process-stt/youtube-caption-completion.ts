import type {
  AggregatedPriceEstimate,
  PreparedSttMedia,
  RuntimeOptions,
  SttCompletionStatus,
  SttTarget
} from '~/types'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { logRunManifestLocation } from '../../../write-manifest-log'
import {
  readStoredYoutubeCaptionSuccess,
  tryResolveYoutubeCaptionTranscription,
  YOUTUBE_CAPTIONS_SERVICE
} from '../youtube-captions'
import { formatSttTargetLabel } from '../stt-targets'
import { writeSttRunManifest } from '../manifest'
import { buildPromptFile, buildProviderModelLabel } from '../stt-prompt'
import { toRequestedProvider } from '../stt-batch/stt-run-state'
import {
  buildSingleStepSummaries,
  filterEstimatedSttCosts,
  resolveSttEstimatedCosts
} from '../stt-costs'
import { resolveRecordedSttStep2 } from './recorded-step2'

type YoutubeCaptionCompletionContext = {
  sourceUrl?: string | undefined
  outputDir: string
  requestedTargets: SttTarget[]
  options: RuntimeOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  prepared: PreparedSttMedia
  acquisitionTimeMs: number
  processStart: number
}

export const completeYoutubeCaptionStt = async ({
  sourceUrl,
  outputDir,
  requestedTargets,
  options,
  preflightEstimate,
  prepared,
  acquisitionTimeMs,
  processStart
}: YoutubeCaptionCompletionContext): Promise<string | undefined> => {
  if (!options.youtubeCaptions || !sourceUrl) {
    return undefined
  }

  const captionTranscription = await readStoredYoutubeCaptionSuccess(outputDir)
    ?? await tryResolveYoutubeCaptionTranscription(sourceUrl, outputDir, prepared.sourceVideoInfo)

  if (!captionTranscription) {
    return undefined
  }

  if (requestedTargets.length > 0) {
    l.write('info', 'STT Provider Skips', {
      category: 'pipeline',
      humanTable: createHumanTable(
        requestedTargets.map((target) => ({
          provider: formatSttTargetLabel(target),
          reason: 'youtube-captions'
        })),
        ['provider', 'reason']
      ),
      metadata: {
        reason: 'youtube-captions',
        skippedProviders: requestedTargets.map(formatSttTargetLabel)
      }
    })
  }

  await buildPromptFile(outputDir, prepared.metadata, captionTranscription.result, prepared.step1Metadata.slug, {
    prompts: options.prompts,
    promptMd: options.promptMd,
    promptSourceProvider: buildProviderModelLabel(captionTranscription.metadata)
  })

  const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, [captionTranscription.target], prepared.durationSeconds, prepared.step1Metadata.url))
  const actual = computeActualCosts({
    step1: prepared.step1Metadata,
    step2: captionTranscription.metadata,
    audioDurationSeconds: prepared.durationSeconds
  })
  const cost = { estimated, actual }
  const estimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: [{
      service: captionTranscription.target.service,
      model: captionTranscription.target.model
    }],
    audioDurationSeconds: prepared.durationSeconds
  })
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: prepared.durationSeconds,
    step2: captionTranscription.metadata
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const metadataJson = JSON.stringify({
    step1: prepared.step1Metadata,
    step2: captionTranscription.metadata,
    resolvedStep2: resolveRecordedSttStep2([captionTranscription.target], options),
    completionStatus: 'full' as SttCompletionStatus,
    requestedProviders: [toRequestedProvider(captionTranscription.target)],
    providerStates: [{
      service: captionTranscription.target.service,
      model: captionTranscription.target.model,
      local: captionTranscription.target.local,
      artifactDir: captionTranscription.relativeDir ?? '.',
      status: 'succeeded',
      attempts: 1
    }],
    missingProviders: [],
    cost,
    ...(timing ? { timing } : {})
  }, null, 2)
  await writeSttRunManifest(outputDir, JSON.parse(metadataJson) as Record<string, unknown>)
  logRunManifestLocation(outputDir, l, 'extract')
  l.debug(`Run manifest:\n${metadataJson}`)

  const artifactFiles: Record<string, string> = {
    audio: prepared.step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    result: 'result.json',
    captions: 'youtube-captions.vtt',
    captionMetadata: 'youtube-captions.json',
    prompt: 'prompt.md',
    run: 'run.json'
  }

  l.report.complete(outputDir, artifactFiles, {
    steps: buildSingleStepSummaries(acquisitionTimeMs, captionTranscription.metadata, actual),
    totalTimeMs: Date.now() - processStart,
    totalCost: actual.totalCost
  })

  return outputDir
}

export { YOUTUBE_CAPTIONS_SERVICE }
