import { mkdir, rm } from 'node:fs/promises'
import type {
  ProcessingOptions,
  Step1Metadata,
  VideoMetadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  AggregatedPriceEstimate,
  RuntimeOptions,
  Step2Metadata,
  SttProviderSuccess,
  SttTarget,
  TranscriptionResult,
  StructuredRunResult,
} from '~/types'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { StepTimingCost } from '~/logger'
import { ensureDirectory } from '~/utils/cli-utils'
import { extractSourceMetadata, createUniqueDirectoryName } from './step-1-download/audio/metadata-utils'
import { sttTarget } from './step-2-stt/orchestrator'
import { formatTranscriptText } from './step-2-stt/stt-utils/stt-utils'
import { collectSttTargets, getSttTargetDirectoryName } from './step-2-stt/stt-targets'
import { prepareSttMedia } from './step-2-stt/media'
import { runLLM } from './step-3-write/run-llm'
import { buildPrompt } from './step-3-write/write-utils/prompt-utils'
import { writeRenderedTextArtifacts } from './step-3-write/text-input-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { runTts } from './step-4-tts/run-tts'
import { buildTtsArtifactMap, collectTtsTargets } from './step-4-tts/tts-targets'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageCount } from './step-5-image/image-targets'
import { runImageGen } from './step-5-image/run-image-gen'
import { runVideoGen } from './step-6-video/run-video-gen'
import { buildVideoArtifactMap } from './step-6-video/video-targets'
import { runMusicGen } from './step-7-music/run-music-gen'
import { buildMusicArtifactMap, collectMusicTargets } from './step-7-music/music-targets'
import { buildProviderStepSummaries } from './generation-command-utils'
import { computeActualCosts, computeEstimatedCosts, parseDurationToSeconds, preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { serializeOneOrMany } from './target-runner'
import { classifySttProviderFailure, prioritizeCloudSttTargetIndices, selectPrimaryPromptProvider } from './process-stt'
import { writeProviderResult, writeRunManifest } from './manifest-utils'
import { tryResolveYoutubeCaptionTranscription, YOUTUBE_CAPTIONS_SERVICE } from './step-2-stt/youtube-captions'

type ProcessVideoRuntimeOptions = Pick<RuntimeOptions, 'sttProviderConcurrency' | 'sttLocalConcurrency' | 'sttSegmentConcurrency'>
  & { outputDir?: string | undefined }

const runTargetPool = async (
  indices: number[],
  concurrency: number,
  worker: (index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= indices.length) {
        return
      }
      await worker(indices[currentIndex] as number)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, indices.length) }, async () => {
      await runWorker()
    })
  )
}

export const processVideo = async (
  options: ProcessingOptions,
  precomputedMetadata?: VideoMetadata,
  preflightEstimate?: AggregatedPriceEstimate,
  runtimeOptions?: ProcessVideoRuntimeOptions
): Promise<string> => {
  const processStart = Date.now()
  const metadata = precomputedMetadata ?? await extractSourceMetadata({
    ...(options.url !== undefined ? { url: options.url } : {}),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
  })
  const baseDir = options.outputDir && options.outputDir.trim().length > 0 ? options.outputDir : './output'
  const outputDir = runtimeOptions?.outputDir ?? `${baseDir}/${createUniqueDirectoryName(metadata.title)}`
  await ensureDirectory(outputDir)
  const processingOptions: ProcessingOptions = {
    ...options,
    outputDir
  }
  const sttTargets = collectSttTargets(processingOptions as unknown as RuntimeOptions)
  let preparedSttMedia: Awaited<ReturnType<typeof prepareSttMedia>> | undefined
  let transcriptionResult: { result: TranscriptionResult, metadata: Step2Metadata | Step2Metadata[] } | undefined
  let successfulSttProviders: SttProviderSuccess[] = []
  let sttFailures: Array<{
    service: string
    model: string
    message: string
    retryable: boolean
    stage?: string | undefined
    status?: number | undefined
  }> = []

  try {
    const step1Start = Date.now()
    preparedSttMedia = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source: {
          ...(options.url !== undefined ? { url: options.url } : {}),
          ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
        },
        targets: sttTargets,
        outputDir
      })
    )
    const step1Time = Date.now() - step1Start
    const step1Metadata: Step1Metadata = preparedSttMedia.step1Metadata
    const sourceMetadata = preparedSttMedia.metadata
    const audioPath = preparedSttMedia.executionArtifacts.sourceMediaPath

    if (processingOptions.youtubeCaptions && processingOptions.url) {
      const captionTranscription = await tryResolveYoutubeCaptionTranscription(
        processingOptions.url,
        outputDir,
        preparedSttMedia.sourceVideoInfo
      )

      if (captionTranscription) {
        if (sttTargets.length > 0) {
          l.info(`YouTube captions selected; skipping requested STT providers: ${sttTargets.map((target) => `${target.service}/${target.model}`).join(', ')}`)
        }

        transcriptionResult = {
          result: captionTranscription.result,
          metadata: captionTranscription.metadata
        }
        successfulSttProviders = [captionTranscription]
      }
    }

    if (successfulSttProviders.length === 0 && sttTargets.length === 1) {
      const target = sttTargets[0] as SttTarget
      const audioDurationSeconds = preparedSttMedia.durationSeconds
      const singleTranscription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
        await sttTarget(audioPath, outputDir, target, {
          split: processingOptions.split,
          reverbVerbatimicity: processingOptions.reverbVerbatimicity,
          sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
          audioDurationSeconds
        })
      )
      transcriptionResult = singleTranscription
      successfulSttProviders = [{
        target,
        metadata: singleTranscription.metadata,
        result: singleTranscription.result
      }]
    } else if (successfulSttProviders.length === 0) {
      const providersDir = `${outputDir}/providers`
      const audioDurationSeconds = preparedSttMedia.durationSeconds
      await mkdir(providersDir, { recursive: true })

      const successes: Array<SttProviderSuccess | undefined> = new Array(sttTargets.length)
      const failuresByIndex = new Map<number, typeof sttFailures[number]>()

      const runTargetAtIndex = async (index: number): Promise<void> => {
        const target = sttTargets[index] as SttTarget
        const providerDirName = getSttTargetDirectoryName(target)
        const providerDir = `${providersDir}/${providerDirName}`
        await mkdir(providerDir, { recursive: true })

        try {
          const providerTranscription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
            await sttTarget(audioPath, providerDir, target, {
              split: processingOptions.split,
              reverbVerbatimicity: processingOptions.reverbVerbatimicity,
              sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
              audioDurationSeconds
            })
          )
          await writeProviderResult(
            providerDir,
            target.service,
            target.model,
            providerTranscription.metadata as Record<string, unknown>,
            providerTranscription.result as Record<string, unknown>
          )
          successes[index] = {
            target,
            metadata: providerTranscription.metadata,
            result: providerTranscription.result,
            relativeDir: `providers/${providerDirName}`
          }
          failuresByIndex.delete(index)
        } catch (error) {
          await rm(providerDir, { recursive: true, force: true })
          failuresByIndex.set(index, {
            service: target.service,
            model: target.model,
            ...classifySttProviderFailure(error)
          })
        }
      }

      const localIndices = sttTargets
        .map((target, index) => ({ target, index }))
        .filter((entry) => entry.target.local)
        .map((entry) => entry.index)
      const cloudIndices = prioritizeCloudSttTargetIndices(sttTargets)

      await Promise.all([
        runTargetPool(localIndices, runtimeOptions?.sttLocalConcurrency ?? 1, runTargetAtIndex),
        runTargetPool(cloudIndices, runtimeOptions?.sttProviderConcurrency ?? 2, runTargetAtIndex)
      ])

      successfulSttProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
      sttFailures = [...failuresByIndex.values()]

      if (successfulSttProviders.length === 0) {
        await rm(providersDir, { recursive: true, force: true })
        throw new Error(sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; '))
      }

      const promptSource = selectPrimaryPromptProvider(successes)
      if (!promptSource) {
        throw new Error('No successful transcription provider available for the write pipeline')
      }

      await Bun.write(`${outputDir}/transcription.txt`, formatTranscriptText(promptSource.result.segments))
      transcriptionResult = {
        result: promptSource.result,
        metadata: successfulSttProviders.map((entry) => entry.metadata)
      }
    }

  if (!transcriptionResult) {
    throw new Error('No transcription result was produced for the write pipeline')
  }
  const finalizedTranscriptionResult = transcriptionResult

  let step3RunResults: StructuredRunResult[] = []
  let step3Results: Step3Metadata[] = []
  if (processingOptions.skipLLM) {
    await runWithLogContext({ step: 'step-3-write' }, async () => {
      const promptPath = `${outputDir}/prompt.md`
      const instruction = await resolvePromptNames(processingOptions.prompts ?? [], {
        exampleFormat: 'json'
      })
      const promptContent = buildPrompt(sourceMetadata, finalizedTranscriptionResult.result, instruction, step1Metadata.slug)
      await Bun.write(promptPath, promptContent)
    })
  } else {
    step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
      await runLLM(sourceMetadata, finalizedTranscriptionResult.result, processingOptions, step1Metadata.slug)
    )
    step3Results = step3RunResults.map((result) => result.metadata)
  }

  const renderedArtifacts = step3RunResults.length > 0
    ? await writeRenderedTextArtifacts({
        outputDir,
        results: step3RunResults,
        writeInternal: processingOptions.renderedText === true,
        sourcePath: options.filePath,
        trackListPath: processingOptions.trackList,
        externalDir: processingOptions.renderedOutDir,
        externalBaseName: step1Metadata.slug
      })
    : { internalArtifacts: {}, externalFiles: [] as string[] }

  if (renderedArtifacts.externalFiles.length > 0) {
    l.info(`Rendered text saved to ${processingOptions.renderedOutDir} (${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'})`)
  }

  let step4Metadata: Step4Metadata[] | null = null
  let step5Metadata: Step5Metadata[] | null = null
  let step6Metadata: Step6VideoMetadata[] | null = null
  let step7Metadata: Step7MusicMetadata[] | null = null
  let ttsCharacterCount: number | undefined
  const ttsTargets = collectTtsTargets(processingOptions)
  const imageTargets = collectImageTargets(processingOptions)
  const musicTargets = collectMusicTargets(processingOptions)
  const ttsRequested = ttsTargets.length > 0
  const imageRequested = imageTargets.length > 0
  const musicRequested = musicTargets.length > 0
  const videoGenRequested = !!(processingOptions.geminiVideoModel || processingOptions.minimaxVideoModel)

  if ((ttsRequested || imageRequested || musicRequested || videoGenRequested) && step3Results.length > 0) {
    if (step3Results.length > 1) {
      if (ttsRequested) l.warn(`TTS skipped: step 4 only runs when write produces exactly one summary, but ${step3Results.length} LLM outputs were generated`)
      if (imageRequested) l.warn(`Image gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
      if (musicRequested) l.warn(`Music gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
      if (videoGenRequested) l.warn(`Video gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
    } else {
      const textContent = step3RunResults[0]?.renderedText ?? ''
      ttsCharacterCount = textContent.length

      const [ttsResult, imageResult, musicResult, videoResult] = await Promise.all([
        ttsRequested
          ? runWithLogContext({ step: 'step-4-tts' }, async () => await runTts(textContent, outputDir, processingOptions))
          : null,
        imageRequested
          ? runWithLogContext({ step: 'step-5-image' }, async () => await runImageGen(textContent, outputDir, processingOptions))
          : null,
        musicRequested
          ? runWithLogContext({ step: 'step-7-music' }, async () => await runMusicGen(textContent, outputDir, processingOptions))
          : null,
        videoGenRequested
          ? runWithLogContext({ step: 'step-6-video' }, async () => await runVideoGen(textContent, outputDir, processingOptions))
          : null
      ])

      step4Metadata = ttsResult?.metadata ?? null
      step5Metadata = imageResult?.metadata ?? null
      step7Metadata = musicResult?.metadata ?? null
      step6Metadata = videoResult?.metadata ?? null
    }
  }

  const step3Serialized = step3Results.length === 1
    ? step3Results[0]
    : step3Results.length > 1
      ? step3Results
      : undefined

  const llmService = processingOptions.openaiModel ? 'openai'
    : processingOptions.groqModel ? 'groq'
      : processingOptions.geminiModel ? 'gemini'
        : processingOptions.anthropicModel ? 'anthropic'
          : processingOptions.minimaxModel ? 'minimax'
            : processingOptions.llamaModel ? 'llama.cpp'
              : undefined
  const llmModel = processingOptions.openaiModel
    ?? processingOptions.groqModel
    ?? processingOptions.geminiModel
    ?? processingOptions.anthropicModel
    ?? processingOptions.minimaxModel
    ?? processingOptions.llamaModel

  const attemptedTtsTargets = step3Results.length === 1 ? ttsTargets : []
  const attemptedImageTargets = step3Results.length === 1 ? imageTargets : []
  const attemptedMusicTargets = step3Results.length === 1 ? musicTargets : []
  const ttsEstimateTargets = attemptedTtsTargets.map((target) => ({ service: target.service, model: target.model }))
  const imageEstimateTargets = attemptedImageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, processingOptions)
  }))
  const llmInputTokenCount = step3Results.length > 0
    ? step3Results.reduce((sum, s3) => sum + s3.inputTokenCount, 0)
    : undefined
  const llmOutputTokenCount = step3Results.length > 0
    ? step3Results.reduce((sum, s3) => sum + s3.outputTokenCount, 0)
    : undefined
  const step2EntriesForEstimation = Array.isArray(transcriptionResult.metadata)
    ? transcriptionResult.metadata
    : [transcriptionResult.metadata]
  const selectedSttTargets = step2EntriesForEstimation.map((entry) => ({
    service: entry.transcriptionService,
    model: entry.transcriptionModel
  }))

  const estimated = preflightEstimate
    ? preflightToEstimated(preflightEstimate)
    : computeEstimatedCosts({
      sttTargets: selectedSttTargets,
      audioDurationSeconds: parseDurationToSeconds(step1Metadata.duration),
      llmService,
      llmModel,
      llmInputTokenCount,
      llmOutputTokenCount,
      skipLLM: processingOptions.skipLLM,
      ttsTargets: ttsEstimateTargets,
      ttsCharacterCount,
      imageTargets: imageEstimateTargets,
      geminiVideoModel: processingOptions.geminiVideoModel,
      minimaxVideoModel: processingOptions.minimaxVideoModel,
      videoDuration: processingOptions.videoDuration,
      videoSize: processingOptions.videoSize,
      videoResolution: processingOptions.videoResolution,
      elevenlabsMusicModel: processingOptions.elevenlabsMusicModel,
      minimaxMusicModel: processingOptions.minimaxMusicModel,
      musicDuration: processingOptions.musicDuration,
      musicLyricsFile: processingOptions.musicLyricsFile,
      musicInstrumental: processingOptions.musicInstrumental
    })

  const actual = computeActualCosts({
    step1: step1Metadata,
    step2: transcriptionResult.metadata,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {})
  })

  const cost = { estimated, actual }
  const estimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: selectedSttTargets,
    audioDurationSeconds: parseDurationToSeconds(step1Metadata.duration),
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    skipLLM: processingOptions.skipLLM,
    ttsTargets: ttsEstimateTargets,
    ttsCharacterCount,
    ...(imageEstimateTargets.length > 0 ? { imageTargets: imageEstimateTargets } : {}),
    ...(step6Metadata && step6Metadata.length > 0
      ? {
          videoTargets: step6Metadata.map((m) => ({
            service: m.videoGenService,
            model: m.videoGenModel,
            ...(typeof m.videoDuration === 'number' ? { durationSeconds: m.videoDuration } : {})
          }))
        }
      : {}),
    ...(attemptedMusicTargets.length > 0
      ? {
          musicTargets: attemptedMusicTargets.map((t) => ({
            service: t.service,
            model: t.model,
            ...(processingOptions.musicDuration !== undefined ? { durationSeconds: processingOptions.musicDuration } : {})
          }))
        }
      : {}),
  })
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: parseDurationToSeconds(step1Metadata.duration),
    step2: transcriptionResult.metadata,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {}),
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const processingMetadata = {
    step1: step1Metadata,
    step2: serializeOneOrMany(Array.isArray(transcriptionResult.metadata) ? transcriptionResult.metadata : [transcriptionResult.metadata]),
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: serializeOneOrMany(step4Metadata) } : {}),
    ...(step5Metadata ? { step5: serializeOneOrMany(step5Metadata) } : {}),
    ...(step6Metadata ? { step6: serializeOneOrMany(step6Metadata) } : {}),
    ...(step7Metadata ? { step7: serializeOneOrMany(step7Metadata) } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(sttFailures.length > 0 ? { errors: sttFailures } : {}),
  }
  const metadataJson = JSON.stringify(processingMetadata, null, 2)
  await writeRunManifest(outputDir, 'write', processingMetadata)
  l.info(`Run manifest:\n${metadataJson}`)

  const totalTime = Date.now() - processStart
  const step2Entries = Array.isArray(transcriptionResult.metadata)
    ? transcriptionResult.metadata
    : [transcriptionResult.metadata]

  const stepSummaries: StepTimingCost[] = [
    {
      label: 'Download',
      processingTime: step1Time,
      cost: 0
    }
  ]

  stepSummaries.push(...buildProviderStepSummaries(
    'Transcribe',
    'stt',
    step2Entries,
    actual.steps,
    (entry) => {
      const displayService = entry.transcriptionService === 'whisper' ? 'whisper.cpp' : entry.transcriptionService
      const displayModel = entry.transcriptionService === 'whisper'
        ? (processingOptions.whisperModel ?? entry.transcriptionModel)
        : entry.transcriptionService === 'reverb'
          ? 'reverb'
          : entry.transcriptionModel
      return `${displayService}/${displayModel}`
    },
    (entry) => entry.processingTime
  ))

  if (step3Results.length > 0) {
    stepSummaries.push(...buildProviderStepSummaries(
      'LLM',
      'llm',
      step3Results,
      actual.steps,
      (entry) => `${entry.llmService}/${entry.llmModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step4Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'TTS',
      'tts',
      step4Metadata,
      actual.steps,
      (entry) => `${entry.ttsService}/${entry.ttsModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step5Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Image',
      'image',
      step5Metadata,
      actual.steps,
      (entry) => `${entry.imageService}/${entry.imageModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step6Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Video',
      'video',
      step6Metadata,
      actual.steps,
      (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step7Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Music',
      'music',
      step7Metadata,
      actual.steps,
      (entry) => `${entry.musicService}/${entry.musicModel}`,
      (entry) => entry.processingTime
    ))
  }

  const artifactFiles: Record<string, string> = {
    audio: step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    ...renderedArtifacts.internalArtifacts
  }
  if (step2Entries.some((entry) => entry.transcriptionService === YOUTUBE_CAPTIONS_SERVICE)) {
    artifactFiles['captions'] = 'youtube-captions.vtt'
    artifactFiles['captionMetadata'] = 'youtube-captions.json'
  }
  if (successfulSttProviders.length > 1) {
    for (const provider of successfulSttProviders) {
      if (!provider.relativeDir) {
        continue
      }
      const key = `${provider.metadata.transcriptionService}-${provider.metadata.transcriptionModel}`
      artifactFiles[`transcript-${key}`] = `${provider.relativeDir}/transcription.txt`
      artifactFiles[`result-${key}`] = `${provider.relativeDir}/result.json`
    }
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else if (step3Results.length > 1) {
    for (const r of step3Results) {
      artifactFiles[`summary-${r.llmModel}`] = r.outputFileName
    }
  }
  if (step4Metadata) {
    Object.assign(artifactFiles, buildTtsArtifactMap(step4Metadata))
  }
  if (step5Metadata) {
    Object.assign(artifactFiles, buildImageArtifactMap(step5Metadata))
  }
  if (step6Metadata) Object.assign(artifactFiles, buildVideoArtifactMap(step6Metadata))
  if (step7Metadata) Object.assign(artifactFiles, buildMusicArtifactMap(step7Metadata))
  artifactFiles['prompt'] = 'prompt.md'
  artifactFiles['run'] = 'run.json'
  l.report.complete(outputDir, artifactFiles, { steps: stepSummaries, totalTimeMs: totalTime, totalCost: actual.totalCost })

  if (sttFailures.length > 0) {
    l.warn(`write run completed with partial STT failures: ${sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`)
  }

    return outputDir
  } finally {
    await preparedSttMedia?.cleanup?.()
  }
}
