import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  BatchChildRunContext,
  RuntimeOptions,
  StepTimingCost,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  TranscriptionResult,
  VideoMetadata,
} from '~/types'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { createUniqueDirectoryName, sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { resolveLLMDefaults } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import { runLLM } from './run-llm'
import {
  buildTextInputPrompt,
  getTextInputTitle,
  resolveTextInputSongTitle,
  writeRenderedTextArtifacts,
} from './text-input-utils'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageCount } from '~/cli/commands/process-steps/step-5-image/image-targets'
import { runImageGen } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { runVideoGen } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { buildVideoArtifactMap, collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { runMusicGen } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { buildMusicArtifactMap, collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { buildProviderStepSummaries } from '~/cli/commands/process-steps/generation-command-utils'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log'
import { writeShowNoteArtifacts } from './show-note-artifacts'

const buildTextInputMetadata = (inputPath: string): VideoMetadata => {
  const title = getTextInputTitle(inputPath)

  return {
    title,
    duration: 'Unknown',
    channel: 'Local',
    description: '',
    url: pathToFileURL(resolve(inputPath)).toString(),
  }
}

const buildTextTranscription = (text: string): TranscriptionResult => ({
  text,
  segments: [{
    start: '00:00:00',
    end: '00:00:00',
    text
  }]
})

const buildStepSummaries = (
  step3Results: Step3Metadata[],
  step4Metadata: Step4Metadata[] | null,
  step5Metadata: Step5Metadata[] | null,
  step6Metadata: Step6VideoMetadata[] | null,
  step7Metadata: Step7MusicMetadata[] | null,
  actualCosts: ReturnType<typeof computeActualCosts>['steps']
): StepTimingCost[] => {
  const summaries: StepTimingCost[] = []

  summaries.push(...buildProviderStepSummaries(
    'LLM',
    'llm',
    step3Results,
    actualCosts,
    (entry) => `${entry.llmService}/${entry.llmModel}`,
    (entry) => entry.processingTime
  ))

  if (step4Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'TTS',
      'tts',
      step4Metadata,
      actualCosts,
      (entry) => `${entry.ttsService}/${entry.ttsModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step5Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Image',
      'image',
      step5Metadata,
      actualCosts,
      (entry) => `${entry.imageService}/${entry.imageModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step6Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Video',
      'video',
      step6Metadata,
      actualCosts,
      (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step7Metadata) {
    summaries.push(...buildProviderStepSummaries(
      'Music',
      'music',
      step7Metadata,
      actualCosts,
      (entry) => `${entry.musicService}/${entry.musicModel}`,
      (entry) => entry.processingTime
    ))
  }

  return summaries
}

export const runTextWrite = async (
  inputPath: string,
  baseDir: string,
  opts: RuntimeOptions,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const sourceText = await Bun.file(inputPath).text()
  if (sourceText.trim().length === 0) {
    throw new Error(`Text input is empty: ${inputPath}`)
  }

  const title = getTextInputTitle(inputPath)
  const songLyricsTitle = await resolveTextInputSongTitle(inputPath, opts.trackList)
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title,
    fallbackLabel: title
  }) ?? `${outputBaseDir}/${createUniqueDirectoryName(title)}`
  await ensureDirectory(outputDir)

  const llmConfig = resolveLLMDefaults(opts)
  const metadata = buildTextInputMetadata(inputPath)
  const transcriptionLike = buildTextTranscription(sourceText)

  const step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
    await runLLM(metadata, transcriptionLike, {
      outputDir,
      prompts: opts.prompts,
      promptFile: opts.promptFile,
      openaiModels: llmConfig.openaiModels,
      openaiModel: llmConfig.openaiModel,
      groqModels: llmConfig.groqModels,
      groqModel: llmConfig.groqModel,
      geminiModels: llmConfig.geminiModels,
      geminiModel: llmConfig.geminiModel,
      anthropicModels: llmConfig.anthropicModels,
      anthropicModel: llmConfig.anthropicModel,
      minimaxModels: llmConfig.minimaxModels,
      minimaxModel: llmConfig.minimaxModel,
      grokModels: llmConfig.grokModels,
      grokModel: llmConfig.grokModel,
      glmModels: llmConfig.glmModels,
      glmModel: llmConfig.glmModel,
      kimiModels: llmConfig.kimiModels,
      kimiModel: llmConfig.kimiModel,
      llamaModels: llmConfig.llamaModels,
      llamaModel: llmConfig.llamaModel,
      llmProviderConcurrency: opts.llmProviderConcurrency,
      llmLocalConcurrency: opts.llmLocalConcurrency,
      structuredContext: {
        songLyricsTitle
      },
      promptBuilder: (instruction: string) =>
        buildTextInputPrompt(sourceText, {
          title,
          sourcePath: inputPath,
          instruction
        })
    })
  )

  const step3Results = step3RunResults.map((result) => result.metadata)
  if (step3Results.length === 0) {
    throw new Error('No LLM outputs generated for text input write')
  }

  const renderedArtifacts = await writeRenderedTextArtifacts({
    outputDir,
    results: step3RunResults,
    writeInternal: opts.renderedText,
    sourcePath: inputPath,
    trackListPath: opts.trackList,
    externalDir: opts.renderedOutDir,
    externalBaseName: title
  })

  if (renderedArtifacts.externalFiles.length > 0) {
    logLocationsTable(l, [{
      artifact: 'renderedOutDir',
      path: opts.renderedOutDir,
      detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
    }])
  }

  let step4Metadata: Step4Metadata[] | null = null
  let step5Metadata: Step5Metadata[] | null = null
  let step6Metadata: Step6VideoMetadata[] | null = null
  let step7Metadata: Step7MusicMetadata[] | null = null
  let ttsCharacterCount: number | undefined

  const ttsTargets = collectTtsTargets(opts)
  const imageTargets = collectImageTargets(opts)
  const videoTargets = collectVideoTargets(opts)
  const musicTargets = collectMusicTargets(opts)
  const ttsRequested = ttsTargets.length > 0
  const imageRequested = imageTargets.length > 0
  const videoRequested = videoTargets.length > 0
  const musicRequested = musicTargets.length > 0

  if ((ttsRequested || imageRequested || musicRequested || videoRequested) && step3Results.length > 1) {
    if (ttsRequested) l.warn(`TTS skipped: step 4 only runs when write produces exactly one summary, but ${step3Results.length} LLM outputs were generated`)
    if (imageRequested) l.warn(`Image gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
    if (musicRequested) l.warn(`Music gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
    if (videoRequested) l.warn(`Video gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
  } else if (step3Results.length === 1 && (ttsRequested || imageRequested || musicRequested || videoRequested)) {
    const renderedText = step3RunResults[0]?.renderedText ?? ''
    ttsCharacterCount = renderedText.length

    const [ttsResult, imageResult, musicResult, videoResult] = await Promise.all([
      ttsRequested
        ? runWithLogContext({ step: 'step-4-tts' }, async () => await runTts(renderedText, outputDir, opts))
        : null,
      imageRequested
        ? runWithLogContext({ step: 'step-5-image' }, async () => await runImageGen(renderedText, outputDir, opts))
        : null,
      musicRequested
        ? runWithLogContext({ step: 'step-7-music' }, async () => await runMusicGen(renderedText, outputDir, opts))
        : null,
      videoRequested
        ? runWithLogContext({ step: 'step-6-video' }, async () => await runVideoGen(renderedText, outputDir, opts))
        : null
    ])

    step4Metadata = ttsResult?.metadata ?? null
    step5Metadata = imageResult?.metadata ?? null
    step7Metadata = musicResult?.metadata ?? null
    step6Metadata = videoResult?.metadata ?? null
  }

  const showNoteArtifacts = await writeShowNoteArtifacts({
    outputDir,
    results: step3RunResults,
    sourceText,
    step4Metadata,
    step5Metadata,
    step6Metadata,
    step7Metadata
  })

  const step3Serialized = step3Results.length === 1
    ? step3Results[0]
    : step3Results

  const llmTargets = step3Results.map((item) => ({
    service: item.llmService,
    model: item.llmModel,
    inputTokens: item.inputTokenCount,
    outputTokens: item.outputTokenCount
  }))

  const attemptedTtsTargets = step3Results.length === 1 ? ttsTargets : []
  const attemptedImageTargets = step3Results.length === 1 ? imageTargets : []
  const attemptedVideoTargets = step3Results.length === 1 ? videoTargets : []
  const attemptedMusicTargets = step3Results.length === 1 ? musicTargets : []
  const ttsEstimateTargets = buildEstimatedTtsTargets(attemptedTtsTargets)
  const imageEstimateTargets = attemptedImageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, opts)
  }))

  const estimated = computeEstimatedCosts({
    applyCostMultipliers: false,
    llmTargets,
    skipLLM: false,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    imageTargets: imageEstimateTargets,
    imageSize: opts.imageSize,
    imageQuality: opts.imageQuality,
    videoTargets: attemptedVideoTargets.map((target) => ({
      service: target.service,
      model: target.model,
      ...(opts.videoDuration !== undefined ? { durationSeconds: opts.videoDuration } : {})
    })),
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoAspectRatio: opts.videoAspectRatio,
    videoResolution: opts.videoResolution,
    videoMode: opts.videoMode,
    musicTargets: attemptedMusicTargets.map((entry) => ({
      service: entry.service,
      model: entry.model,
      ...(opts.musicDuration !== undefined ? { durationSeconds: opts.musicDuration } : {})
    })),
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  const actual = computeActualCosts({
    step3: step3Serialized,
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })

  const cost = { estimated, actual }
  const estimatedTiming = computeEstimatedProcessingTimes({
    llmTargets,
    skipLLM: false,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    ...(imageEstimateTargets.length > 0 ? { imageTargets: imageEstimateTargets } : {}),
    ...(attemptedVideoTargets.length > 0
      ? {
          videoTargets: attemptedVideoTargets.map((entry) => ({
            service: entry.service,
            model: entry.model,
            ...(opts.videoDuration !== undefined ? { durationSeconds: opts.videoDuration } : {})
          }))
        }
      : {}),
    ...(attemptedMusicTargets.length > 0
      ? {
          musicTargets: attemptedMusicTargets.map((entry) => ({
            service: entry.service,
            model: entry.model,
            ...(opts.musicDuration !== undefined ? { durationSeconds: opts.musicDuration } : {})
          }))
        }
      : {})
  })
  const actualTiming = computeActualProcessingTimes({
    step3: step3Serialized,
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const manifestMetadata = {
    title,
    source: {
      kind: 'text-input',
      inputPath,
      slug: sanitizeTitleSlug(title, 180)
    },
    step3: serializeOneOrMany(step3Results),
    ...(step4Metadata ? { step4: serializeOneOrMany(step4Metadata) } : {}),
    ...(step5Metadata ? { step5: serializeOneOrMany(step5Metadata) } : {}),
    ...(step6Metadata ? { step6: serializeOneOrMany(step6Metadata) } : {}),
    ...(step7Metadata ? { step7: serializeOneOrMany(step7Metadata) } : {}),
    cost,
    ...(timing ? { timing } : {}),
  }

  await writeRunManifest(outputDir, 'write', manifestMetadata)
  logWriteManifestConsoleSummary(outputDir, manifestMetadata, {
    promptArtifact: 'prompt.md',
    ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
      ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
      : {})
  })

  const totalTimeMs = actualTiming.totalProcessingTimeMs
  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    run: 'run.json',
    ...renderedArtifacts.internalArtifacts,
    ...showNoteArtifacts.internalArtifacts
  }

  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else {
    for (const step3 of step3Results) {
      artifactFiles[`summary-${step3.llmModel}`] = step3.outputFileName
    }
  }
  if (step4Metadata) {
    Object.assign(artifactFiles, buildTtsArtifactMap(step4Metadata))
  }
  if (step5Metadata) {
    Object.assign(artifactFiles, buildImageArtifactMap(step5Metadata))
  }
  if (step6Metadata) {
    Object.assign(artifactFiles, buildVideoArtifactMap(step6Metadata))
  }
  if (step7Metadata) {
    Object.assign(artifactFiles, buildMusicArtifactMap(step7Metadata))
  }

  l.report.complete(outputDir, artifactFiles, {
    steps: buildStepSummaries(step3Results, step4Metadata, step5Metadata, step6Metadata, step7Metadata, actual.steps),
    totalTimeMs,
    totalCost: actual.totalCost
  })

  return { outputDir }
}
