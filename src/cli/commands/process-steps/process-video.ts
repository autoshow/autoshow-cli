import type { ProcessingOptions, Step1Metadata, VideoMetadata, Step3Metadata, Step7MusicMetadata, AggregatedPriceEstimate } from '~/types'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { StepTimingCost } from '~/logger'
import { ensureDirectory } from '~/utils/cli-utils'
import { extractSourceMetadata, createUniqueDirectoryName } from './step-1-download/audio/metadata-utils'
import { downloadAudio } from './step-1-download/audio/dl-audio'
import { transcribe } from './step-2-stt/run-transcribe'
import { runLLM } from './step-3-write/run-llm'
import { buildPrompt } from './step-3-write/write-utils/prompt-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import type { StructuredRunResult } from './step-3-write/structured-output/types'
import { runTts } from './step-4-tts/run-tts'
import { runImageGen } from './step-5-image/run-image-gen'
import { runVideoGen } from './step-6-video/run-video-gen'
import { runMusicGen } from './step-7-music/run-music-gen'
import { computeActualCosts, computeEstimatedCosts, parseDurationToSeconds, preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'

export const processVideo = async (options: ProcessingOptions, precomputedMetadata?: VideoMetadata, preflightEstimate?: AggregatedPriceEstimate): Promise<string> => {
  const processStart = Date.now()
  const metadata = precomputedMetadata ?? await extractSourceMetadata({
    ...(options.url !== undefined ? { url: options.url } : {}),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
  })
  const baseDir = options.outputDir && options.outputDir.trim().length > 0 ? options.outputDir : './output'
  const uniqueDirName = createUniqueDirectoryName(metadata.title)
  const outputDir = `${baseDir}/${uniqueDirName}`
  await ensureDirectory(outputDir)
  const processingOptions: ProcessingOptions = {
    ...options,
    outputDir
  }
  const step1Start = Date.now()
  const { audioPath, metadata: downloadMetadata } = await runWithLogContext({ step: 'step-1-download' }, async () =>
    await downloadAudio(processingOptions, metadata)
  )
  const step1Time = Date.now() - step1Start
  const step1Metadata: Step1Metadata = downloadMetadata
  const transcriptionResult = await runWithLogContext({ step: 'step-2-stt' }, async () =>
    await transcribe(audioPath, processingOptions)
  )
  
  let step3RunResults: StructuredRunResult[] = []
  let step3Results: Step3Metadata[] = []
  if (processingOptions.skipLLM) {
    await runWithLogContext({ step: 'step-3-write' }, async () => {
      const promptPath = `${outputDir}/prompt.md`
      const instruction = await resolvePromptNames(processingOptions.prompts ?? [])
      const promptContent = buildPrompt(metadata, transcriptionResult.result, instruction)
      await Bun.write(promptPath, promptContent)
    })
  } else {
    step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
      await runLLM(metadata, transcriptionResult.result, processingOptions)
    )
    step3Results = step3RunResults.map((result) => result.metadata)
  }

  let step4Metadata = null
  let step5Metadata = null
  let step6Metadata = null
  let step7Metadata: Step7MusicMetadata | null = null
  let ttsCharacterCount: number | undefined
  const ttsRequested = !!(
    processingOptions.kittenTtsModel ||
    processingOptions.elevenlabsTtsModel ||
    processingOptions.minimaxTtsModel ||
    processingOptions.groqTtsModel ||
    processingOptions.openaiTtsModel ||
    processingOptions.geminiTtsModel
  )
  const imageRequested = !!(processingOptions.geminiImageModel || processingOptions.openaiImageModel || processingOptions.minimaxImageModel)
  const musicRequested = !!(processingOptions.elevenlabsMusicModel || processingOptions.minimaxMusicModel)
  const videoGenRequested = !!(processingOptions.soraVideoModel || processingOptions.geminiVideoModel || processingOptions.minimaxVideoModel)

  if ((ttsRequested || imageRequested || musicRequested || videoGenRequested) && step3Results.length > 0) {
    if (step3Results.length > 1) {
      if (ttsRequested) l.warn(`TTS skipped: cannot determine which of ${step3Results.length} LLM outputs to synthesize`)
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

  const llmService = processingOptions.useOpenAI ? 'openai'
    : processingOptions.groqModel ? 'groq'
      : processingOptions.useGemini ? 'gemini'
        : processingOptions.useAnthropic ? 'anthropic'
          : processingOptions.minimaxModel ? 'minimax'
            : processingOptions.llamaModel ? 'llama.cpp'
              : undefined
  const llmModel = processingOptions.useOpenAI ? processingOptions.openaiModel
    : processingOptions.groqModel ? processingOptions.groqModel
      : processingOptions.useGemini ? processingOptions.geminiModel
        : processingOptions.useAnthropic ? processingOptions.anthropicModel
          : processingOptions.minimaxModel ? processingOptions.minimaxModel
            : processingOptions.llamaModel

  const ttsService = processingOptions.kittenTtsModel ? 'kitten'
    : processingOptions.elevenlabsTtsModel ? 'elevenlabs'
      : processingOptions.minimaxTtsModel ? 'minimax'
        : processingOptions.groqTtsModel ? 'groq'
          : processingOptions.openaiTtsModel ? 'openai'
            : processingOptions.geminiTtsModel ? 'gemini'
              : undefined
  const ttsModel = processingOptions.kittenTtsModel
    || processingOptions.elevenlabsTtsModel
    || processingOptions.minimaxTtsModel
    || processingOptions.groqTtsModel
    || processingOptions.openaiTtsModel
    || processingOptions.geminiTtsModel
  const llmInputTokenCount = step3Results.length > 0
    ? step3Results.reduce((sum, s3) => sum + s3.inputTokenCount, 0)
    : undefined
  const llmOutputTokenCount = step3Results.length > 0
    ? step3Results.reduce((sum, s3) => sum + s3.outputTokenCount, 0)
    : undefined

  const estimated = preflightEstimate
    ? preflightToEstimated(preflightEstimate)
    : computeEstimatedCosts({
      whisperModel: processingOptions.whisperModel,
      groqSttModel: processingOptions.groqSttModel,
      elevenlabsSttModel: processingOptions.elevenlabsSttModel,
      openaiSttModel: processingOptions.openaiSttModel,
      mistralSttModel: processingOptions.mistralSttModel,
      assemblyaiSttModel: processingOptions.assemblyaiSttModel,
      useReverb: processingOptions.useReverb,
      audioDurationSeconds: parseDurationToSeconds(step1Metadata.duration),
      llmService,
      llmModel,
      llmInputTokenCount,
      llmOutputTokenCount,
      skipLLM: processingOptions.skipLLM,
      ttsService,
      ttsModel,
      ttsCharacterCount,
      geminiImageModel: processingOptions.geminiImageModel,
      openaiImageModel: processingOptions.openaiImageModel,
      minimaxImageModel: processingOptions.minimaxImageModel,
      imagenCount: processingOptions.imagenCount,
      soraVideoModel: processingOptions.soraVideoModel,
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
    transcriptionService: transcriptionResult.metadata.transcriptionService,
    transcriptionModel: transcriptionResult.metadata.transcriptionModelName ?? transcriptionResult.metadata.transcriptionModel,
    audioDurationSeconds: parseDurationToSeconds(step1Metadata.duration),
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    skipLLM: processingOptions.skipLLM,
    ttsService,
    ttsModel,
    ttsCharacterCount,
    ...(step5Metadata
      ? {
          imageService: step5Metadata.imageService,
          imageModel: step5Metadata.imageModel,
          imageCount: processingOptions.imagenCount ?? 1,
        }
      : {}),
    ...(step6Metadata
      ? {
          videoService: step6Metadata.videoGenService,
          videoModel: step6Metadata.videoGenModel,
          videoDurationSeconds: step6Metadata.videoDuration,
        }
      : {}),
    ...(step7Metadata
      ? {
          musicService: step7Metadata.musicService,
          musicModel: step7Metadata.musicModel,
          musicDurationSeconds: typeof step7Metadata.musicDurationMs === 'number'
            ? step7Metadata.musicDurationMs / 1000
            : undefined,
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
    step2: transcriptionResult.metadata,
    ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
    ...(step4Metadata ? { step4: step4Metadata } : {}),
    ...(step5Metadata ? { step5: step5Metadata } : {}),
    ...(step6Metadata ? { step6: step6Metadata } : {}),
    ...(step7Metadata ? { step7: step7Metadata } : {}),
    cost,
    ...(timing ? { timing } : {}),
  }
  const metadataPath = `${outputDir}/metadata.json`
  const metadataJson = JSON.stringify(processingMetadata, null, 2)
  await Bun.write(metadataPath, metadataJson)
  l.info(`Metadata:\n${metadataJson}`)

  const totalTime = Date.now() - processStart

  const stepSummaries: StepTimingCost[] = [
    {
      label: 'Download',
      processingTime: step1Time,
      cost: 0
    },
    {
      label: 'Transcribe',
      providerModel: (() => {
        const { transcriptionService, transcriptionModel, transcriptionModelName } = transcriptionResult.metadata
        const displayService = transcriptionService === 'whisper' ? 'whisper.cpp' : transcriptionService
        const displayModel = transcriptionService === 'whisper'
          ? (transcriptionModelName ?? processingOptions.whisperModel ?? transcriptionModel)
          : transcriptionService === 'reverb'
            ? 'reverb'
            : (transcriptionModelName ?? transcriptionModel)
        return `${displayService}/${displayModel}`
      })(),
      processingTime: transcriptionResult.metadata.processingTime,
      cost: actual.steps.find(s => s.step === 'stt')?.cost ?? 0
    }
  ]

  if (step3Results.length > 0) {
    const llmSteps = actual.steps.filter(s => s.step === 'llm')
    for (const [i, s3] of step3Results.entries()) {
      stepSummaries.push({
        label: 'LLM',
        providerModel: `${s3.llmService}/${s3.llmModel}`,
        processingTime: s3.processingTime,
        cost: llmSteps[i]?.cost ?? 0
      })
    }
  }

  if (step4Metadata) {
    stepSummaries.push({
      label: 'TTS',
      providerModel: `${step4Metadata.ttsService}/${step4Metadata.ttsModel}`,
      processingTime: step4Metadata.processingTime,
      cost: actual.steps.find(s => s.step === 'tts')?.cost ?? 0
    })
  }

  if (step5Metadata) {
    stepSummaries.push({
      label: 'Image',
      providerModel: `${step5Metadata.imageService}/${step5Metadata.imageModel}`,
      processingTime: step5Metadata.processingTime,
      cost: actual.steps.find(s => s.step === 'image')?.cost ?? 0
    })
  }

  if (step6Metadata) {
    stepSummaries.push({
      label: 'Video',
      providerModel: `${step6Metadata.videoGenService}/${step6Metadata.videoGenModel}`,
      processingTime: step6Metadata.processingTime,
      cost: actual.steps.find(s => s.step === 'video')?.cost ?? 0
    })
  }

  if (step7Metadata) {
    stepSummaries.push({
      label: 'Music',
      providerModel: `${step7Metadata.musicService}/${step7Metadata.musicModel}`,
      processingTime: step7Metadata.processingTime,
      cost: actual.steps.find(s => s.step === 'music')?.cost ?? 0
    })
  }

  const artifactFiles: Record<string, string> = {
    audio: step1Metadata.audioFileName,
    transcript: 'transcription.txt'
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.md'
  } else if (step3Results.length > 1) {
    for (const r of step3Results) {
      artifactFiles[`summary-${r.llmModel}`] = r.outputFileName
    }
  }
  if (step4Metadata) artifactFiles['speech'] = 'speech.wav'
  if (step5Metadata) artifactFiles['image'] = step5Metadata.imageFileName
  if (step6Metadata) artifactFiles['video'] = step6Metadata.videoFileName
  if (step7Metadata) artifactFiles['music'] = step7Metadata.musicFileName
  artifactFiles['prompt'] = 'prompt.md'
  artifactFiles['metadata'] = 'metadata.json'
  l.report.complete(outputDir, artifactFiles, { steps: stepSummaries, totalTimeMs: totalTime, totalCost: actual.totalCost })

  return outputDir
}
