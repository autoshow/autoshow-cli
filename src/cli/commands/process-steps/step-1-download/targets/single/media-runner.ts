import { ProcessingOptionsSchema, type AggregatedPriceEstimate, type BatchChildRunContext, type BatchItem, type BatchItemProcessResult, type ProcessingOptions, type RuntimeOptions, type VideoMetadata, type WebArticleMetadata } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import { processVideo } from '~/cli/commands/process-steps/process-video'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { buildMediaStep1Slug, createUniqueDirectoryName, extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { isLikelyUrl } from '../input/input-classifier'
import { resolveLLMDefaults } from '../llm-defaults'
import { writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'

export const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelURL?: string, publishDate?: string, duration: string } }> => {
  const llmConfig = resolveLLMDefaults(llmDefaults)

  if (llmDefaults.split) {
    l.write('info', 'Audio will be split into 30-minute segments for transcription')
  }

  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)
  const srcUrl = isUrl ? target : exists ? `file://${target}` : target

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = await extractSourceMetadata(src)
  const batchOutputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  })

  const baseOptions: Record<string, unknown> = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    whisperModels: llmDefaults.whisperModels,
    whisperModel: llmDefaults.whisperModel,
    youtubeCaptions: llmDefaults.youtubeCaptions,
    gcloudSttModels: llmDefaults.gcloudSttModels,
    gcloudSttModel: llmDefaults.gcloudSttModel,
    awsSttModels: llmDefaults.awsSttModels,
    awsSttModel: llmDefaults.awsSttModel,
    deepinfraSttModels: llmDefaults.deepinfraSttModels,
    deepinfraSttModel: llmDefaults.deepinfraSttModel,
    awsRegion: llmDefaults.awsRegion,
    awsBucket: llmDefaults.awsBucket,
    groqSttModels: llmDefaults.groqSttModels,
    groqSttModel: llmDefaults.groqSttModel,
    grokSttModels: llmDefaults.grokSttModels,
    grokSttModel: llmDefaults.grokSttModel,
    elevenlabsSttModels: llmDefaults.elevenlabsSttModels,
    elevenlabsSttModel: llmDefaults.elevenlabsSttModel,
    deepgramSttModels: llmDefaults.deepgramSttModels,
    deepgramSttModel: llmDefaults.deepgramSttModel,
    sonioxSttModels: llmDefaults.sonioxSttModels,
    sonioxSttModel: llmDefaults.sonioxSttModel,
    speechmaticsSttModels: llmDefaults.speechmaticsSttModels,
    speechmaticsSttModel: llmDefaults.speechmaticsSttModel,
    revSttModels: llmDefaults.revSttModels,
    revSttModel: llmDefaults.revSttModel,
    mistralSttModels: llmDefaults.mistralSttModels,
    mistralSttModel: llmDefaults.mistralSttModel,
    assemblyaiSttModels: llmDefaults.assemblyaiSttModels,
    assemblyaiSttModel: llmDefaults.assemblyaiSttModel,
    gladiaSttModels: llmDefaults.gladiaSttModels,
    gladiaSttModel: llmDefaults.gladiaSttModel,
    diarizationSpeakerCount: llmDefaults.diarizationSpeakerCount,
    refreshCache: llmDefaults.refreshCache,
    noCache: llmDefaults.noCache,
    llamaModels: llmConfig.llamaModels,
    llamaModel: llmConfig.llamaModel,
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
    llmProviderConcurrency: llmDefaults.llmProviderConcurrency,
    llmLocalConcurrency: llmDefaults.llmLocalConcurrency,
    outputDir: baseDir,
    useReverb: llmDefaults.useReverb,
    reverbVerbatimicity: llmDefaults.reverbVerbatimicity,
    split: llmDefaults.split,
    skipLLM: llmDefaults.skipLLM,
    prompts: llmDefaults.prompts,
    promptFile: llmDefaults.promptFile,
    renderedText: llmDefaults.renderedText,
    renderedOutDir: llmDefaults.renderedOutDir,
    trackList: llmDefaults.trackList,
    ttsSpeaker: llmDefaults.ttsSpeaker,
    kittenTtsModels: llmDefaults.kittenTtsModels,
    kittenTtsModel: llmDefaults.kittenTtsModel,
    groqTtsModels: llmDefaults.groqTtsModels,
    groqTtsModel: llmDefaults.groqTtsModel,
    groqVoiceId: llmDefaults.groqVoiceId,
    grokTtsModels: llmDefaults.grokTtsModels,
    grokTtsModel: llmDefaults.grokTtsModel,
    grokTtsVoice: llmDefaults.grokTtsVoice,
    mistralTtsModels: llmDefaults.mistralTtsModels,
    mistralTtsModel: llmDefaults.mistralTtsModel,
    mistralTtsVoice: llmDefaults.mistralTtsVoice,
    mistralTtsRefAudio: llmDefaults.mistralTtsRefAudio,
    ttsDialogueFormat: llmDefaults.ttsDialogueFormat,
    ttsSpeakerRefAudios: llmDefaults.ttsSpeakerRefAudios,
    openaiTtsModels: llmDefaults.openaiTtsModels,
    openaiTtsModel: llmDefaults.openaiTtsModel,
    openaiVoiceId: llmDefaults.openaiVoiceId,
    openaiTtsRefAudio: llmDefaults.openaiTtsRefAudio,
    openaiTtsConsentId: llmDefaults.openaiTtsConsentId,
    openaiTtsConsentAudio: llmDefaults.openaiTtsConsentAudio,
    openaiTtsConsentLanguage: llmDefaults.openaiTtsConsentLanguage,
    openaiTtsConsentName: llmDefaults.openaiTtsConsentName,
    openaiTtsVoiceName: llmDefaults.openaiTtsVoiceName,
    geminiTtsModels: llmDefaults.geminiTtsModels,
    geminiTtsModel: llmDefaults.geminiTtsModel,
    geminiVoiceId: llmDefaults.geminiVoiceId,
    geminiSpeaker1Name: llmDefaults.geminiSpeaker1Name,
    geminiSpeaker1Voice: llmDefaults.geminiSpeaker1Voice,
    geminiSpeaker2Name: llmDefaults.geminiSpeaker2Name,
    geminiSpeaker2Voice: llmDefaults.geminiSpeaker2Voice,
    elevenlabsTtsModels: llmDefaults.elevenlabsTtsModels,
    elevenlabsTtsModel: llmDefaults.elevenlabsTtsModel,
    elevenlabsVoiceId: llmDefaults.elevenlabsVoiceId,
    elevenlabsTtsPvcVoice: llmDefaults.elevenlabsTtsPvcVoice,
    elevenlabsTtsRefAudio: llmDefaults.elevenlabsTtsRefAudio,
    elevenlabsTtsVoiceName: llmDefaults.elevenlabsTtsVoiceName,
    elevenlabsTtsCloneRemoveBackgroundNoise: llmDefaults.elevenlabsTtsCloneRemoveBackgroundNoise,
    elevenlabsTtsPvcSamples: llmDefaults.elevenlabsTtsPvcSamples,
    elevenlabsTtsPvcSampleDir: llmDefaults.elevenlabsTtsPvcSampleDir,
    elevenlabsTtsPvcLanguage: llmDefaults.elevenlabsTtsPvcLanguage,
    elevenlabsTtsPvcDescription: llmDefaults.elevenlabsTtsPvcDescription,
    elevenlabsTtsPvcCaptchaOut: llmDefaults.elevenlabsTtsPvcCaptchaOut,
    elevenlabsTtsPvcVerifyAudio: llmDefaults.elevenlabsTtsPvcVerifyAudio,
    elevenlabsTtsPvcWait: llmDefaults.elevenlabsTtsPvcWait,
    minimaxTtsModels: llmDefaults.minimaxTtsModels,
    minimaxTtsModel: llmDefaults.minimaxTtsModel,
    minimaxTtsVoice: llmDefaults.minimaxTtsVoice,
    minimaxTtsRefAudio: llmDefaults.minimaxTtsRefAudio,
    minimaxTtsPromptAudio: llmDefaults.minimaxTtsPromptAudio,
    minimaxTtsPromptText: llmDefaults.minimaxTtsPromptText,
    minimaxTtsCloneNoiseReduction: llmDefaults.minimaxTtsCloneNoiseReduction,
    minimaxTtsCloneVolumeNormalization: llmDefaults.minimaxTtsCloneVolumeNormalization,
    deepgramTtsModels: llmDefaults.deepgramTtsModels,
    deepgramTtsModel: llmDefaults.deepgramTtsModel,
    deepgramVoiceId: llmDefaults.deepgramVoiceId,
    runwayTtsModels: llmDefaults.runwayTtsModels,
    runwayTtsModel: llmDefaults.runwayTtsModel,
    runwayTtsVoice: llmDefaults.runwayTtsVoice,
    speechifyTtsModels: llmDefaults.speechifyTtsModels,
    speechifyTtsModel: llmDefaults.speechifyTtsModel,
    speechifyVoice: llmDefaults.speechifyVoice,
    speechifyTtsRefAudio: llmDefaults.speechifyTtsRefAudio,
    speechifyTtsVoiceName: llmDefaults.speechifyTtsVoiceName,
    speechifyTtsConsentName: llmDefaults.speechifyTtsConsentName,
    speechifyTtsConsentEmail: llmDefaults.speechifyTtsConsentEmail,
    speechifyTtsVoiceLocale: llmDefaults.speechifyTtsVoiceLocale,
    speechifyTtsVoiceGender: llmDefaults.speechifyTtsVoiceGender,
    gcloudTtsModels: llmDefaults.gcloudTtsModels,
    gcloudTtsModel: llmDefaults.gcloudTtsModel,
    gcloudTtsVoice: llmDefaults.gcloudTtsVoice,
    gcloudTtsLanguage: llmDefaults.gcloudTtsLanguage,
    gcloudTtsRefAudio: llmDefaults.gcloudTtsRefAudio,
    gcloudTtsConsentAudio: llmDefaults.gcloudTtsConsentAudio,
    gcloudTtsConsentLanguage: llmDefaults.gcloudTtsConsentLanguage,
    gcloudTtsVoiceCloningKey: llmDefaults.gcloudTtsVoiceCloningKey,
    gcloudTtsVoiceCloningKeyOut: llmDefaults.gcloudTtsVoiceCloningKeyOut,
    deapiTtsModels: llmDefaults.deapiTtsModels,
    deapiTtsModel: llmDefaults.deapiTtsModel,
    deapiTtsVoice: llmDefaults.deapiTtsVoice,
    deapiTtsRefAudio: llmDefaults.deapiTtsRefAudio,
    deapiTtsRefText: llmDefaults.deapiTtsRefText,
    geminiImageModels: llmDefaults.geminiImageModels,
    geminiImageModel: llmDefaults.geminiImageModel,
    openaiImageModels: llmDefaults.openaiImageModels,
    openaiImageModel: llmDefaults.openaiImageModel,
    minimaxImageModels: llmDefaults.minimaxImageModels,
    minimaxImageModel: llmDefaults.minimaxImageModel,
    glmImageModels: llmDefaults.glmImageModels,
    glmImageModel: llmDefaults.glmImageModel,
    grokImageModels: llmDefaults.grokImageModels,
    grokImageModel: llmDefaults.grokImageModel,
    runwayImageModels: llmDefaults.runwayImageModels,
    runwayImageModel: llmDefaults.runwayImageModel,
    imageAspectRatio: llmDefaults.imageAspectRatio,
    imageSize: llmDefaults.imageSize,
    imageQuality: llmDefaults.imageQuality,
    imageFormat: llmDefaults.imageFormat,
    imageBackground: llmDefaults.imageBackground,
    imagenCount: llmDefaults.imagenCount,
    elevenlabsMusicModels: llmDefaults.elevenlabsMusicModels,
    elevenlabsMusicModel: llmDefaults.elevenlabsMusicModel,
    minimaxMusicModels: llmDefaults.minimaxMusicModels,
    minimaxMusicModel: llmDefaults.minimaxMusicModel,
    deapiMusicModels: llmDefaults.deapiMusicModels,
    deapiMusicModel: llmDefaults.deapiMusicModel,
    geminiMusicModels: llmDefaults.geminiMusicModels,
    geminiMusicModel: llmDefaults.geminiMusicModel,
    musicDuration: llmDefaults.musicDuration,
    musicLyricsFile: llmDefaults.musicLyricsFile,
    musicInstrumental: llmDefaults.musicInstrumental,
    geminiVideoModels: llmDefaults.geminiVideoModels,
    geminiVideoModel: llmDefaults.geminiVideoModel,
    minimaxVideoModels: llmDefaults.minimaxVideoModels,
    minimaxVideoModel: llmDefaults.minimaxVideoModel,
    glmVideoModels: llmDefaults.glmVideoModels,
    glmVideoModel: llmDefaults.glmVideoModel,
    grokVideoModels: llmDefaults.grokVideoModels,
    grokVideoModel: llmDefaults.grokVideoModel,
    runwayVideoModels: llmDefaults.runwayVideoModels,
    runwayVideoModel: llmDefaults.runwayVideoModel,
    videoDuration: llmDefaults.videoDuration,
    videoSize: llmDefaults.videoSize,
    videoAspectRatio: llmDefaults.videoAspectRatio,
    videoResolution: llmDefaults.videoResolution,
    mistralOcrModels: llmDefaults.mistralOcrModels,
    mistralOcrModel: llmDefaults.mistralOcrModel,
    glmOcrModels: llmDefaults.glmOcrModels,
    glmOcrModel: llmDefaults.glmOcrModel,
    kimiOcrModels: llmDefaults.kimiOcrModels,
    kimiOcrModel: llmDefaults.kimiOcrModel,
    openaiOcrModels: llmDefaults.openaiOcrModels,
    openaiOcrModel: llmDefaults.openaiOcrModel,
    anthropicOcrModels: llmDefaults.anthropicOcrModels,
    anthropicOcrModel: llmDefaults.anthropicOcrModel,
    geminiOcrModels: llmDefaults.geminiOcrModels,
    geminiOcrModel: llmDefaults.geminiOcrModel,
    deepinfraOcrModels: llmDefaults.deepinfraOcrModels,
    deepinfraOcrModel: llmDefaults.deepinfraOcrModel,
    deapiOcrModels: llmDefaults.deapiOcrModels,
    deapiOcrModel: llmDefaults.deapiOcrModel
  }

  const options: ProcessingOptions = validateData(ProcessingOptionsSchema, baseOptions, 'processing options')

  const outDir = await processVideo(options, meta, preflightEstimate, {
    ...(batchOutputDir ? { outputDir: batchOutputDir } : {}),
    outputRootDir: llmDefaults.outputRootDir,
    sttProviderConcurrency: llmDefaults.sttProviderConcurrency,
    sttLocalConcurrency: llmDefaults.sttLocalConcurrency,
    sttSegmentConcurrency: llmDefaults.sttSegmentConcurrency,
  })
  const baseInfo: { url: string, title: string, channel: string, duration: string, channelURL?: string, publishDate?: string } = {
    url: srcUrl,
    title: meta.title,
    channel: meta.channel,
    duration: meta.duration
  }

  if (meta.channelURL) {
    baseInfo.channelURL = meta.channelURL
  }
  if (meta.publishDate) {
    baseInfo.publishDate = meta.publishDate
  }

  return { outputDir: outDir, info: baseInfo }
}

const normalizeBatchItemDuration = (duration?: string): string | undefined => {
  if (!duration || duration.length === 0) {
    return undefined
  }

  if (duration.includes(':')) {
    return duration
  }

  if (!/^\d+$/.test(duration)) {
    return duration
  }

  const totalSeconds = Number.parseInt(duration, 10)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return duration
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const mergeBatchItemMetadata = (
  meta: VideoMetadata,
  batchItem?: BatchItem
): VideoMetadata => {
  if (!batchItem) {
    return meta
  }

  const publishDate = normalizeBatchChildPublishedAt(batchItem.publishedAt)
  const duration = normalizeBatchItemDuration(batchItem.duration)

  return {
    ...meta,
    ...(batchItem.title ? { title: batchItem.title } : {}),
    ...(batchItem.author ? { channel: batchItem.author } : {}),
    ...(duration ? { duration } : {}),
    ...(publishDate ? { publishDate } : {})
  }
}

const buildDownloadManifestEntry = (
  step1Metadata: Record<string, unknown>,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  step1: step1Metadata,
  ...(web ? { web } : {}),
  cost: {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }
})

export const processMetadataMedia = async (
  target: string,
  opts: RuntimeOptions,
  baseDir: string,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) src.url = target
  if (!isUrl && exists) src.filePath = target

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const slug = buildMediaStep1Slug(src, meta)

  const metadata = {
    title: meta.title,
    slug,
    duration: meta.duration,
    channel: meta.channel,
    url: meta.url,
    ...(meta.publishDate ? { publishDate: meta.publishDate } : {}),
    ...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
    ...(meta.channelURL ? { channelURL: meta.channelURL } : {}),
    ...(meta.chapters?.length ? { chapters: meta.chapters } : {}),
    ...(meta.description?.length ? { description: meta.description } : {})
  }

  writeMetadataTerminalOutput(metadata, opts.markdown)

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(meta.title)}`
  await ensureDirectory(outputDir)
  await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
  return { outputDir }
}

export const processDownloadMedia = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const useFlatBatchOutput = opts.flatBatch && batchChildContext !== undefined
  const outputDir = useFlatBatchOutput
    ? effectiveBaseDir
    : await reserveBatchChildOutputDir(batchChildContext, {
        title: meta.title,
        publishedAt: meta.publishDate,
        fallbackLabel: meta.title
      }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(meta.title)}`
  await ensureDirectory(outputDir)

  const dlOpts = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    outputDir,
    ...(batchItem?.directDownload ? { directDownload: true } : {}),
    keepOriginalMedia: opts.keepOriginalMedia,
    bestQuality: opts.bestQuality
  }

  const { metadata: step1Metadata } = await downloadAudio(dlOpts, meta)
  const manifestEntry = buildDownloadManifestEntry(step1Metadata)

  if (useFlatBatchOutput) {
    l.write('info', `Saved media file: ${step1Metadata.audioFileName}`)
    return { manifestEntry }
  }

  await writeRunManifest(outputDir, 'download', manifestEntry)

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, run: 'run.json' })

  return { outputDir }
}
