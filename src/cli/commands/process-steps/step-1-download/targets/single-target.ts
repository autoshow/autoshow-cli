import { basename, join, resolve as pathResolve } from 'node:path'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as l from '~/logger'
import { validateData } from '~/utils/validate/validation'
import { ProcessingOptionsSchema, type ProcessingOptions, type Step3Metadata, type VideoMetadata, type TranscriptionResult } from '~/types'
import { processVideo } from '~/cli/commands/process-steps/process-video'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { ensureDirectory, fileExists, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName, extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { downloadDocument } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { processDocument } from '~/cli/commands/process-steps/process-document'
import { detectDocumentFormat } from '~/cli/commands/process-steps/step-1-download/document/detect-format'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-2-document/document-utils/doc-prompt-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import type { ExtractionOptions } from '~/types'
import type { ProcessCommand, RuntimeOptions, AggregatedPriceEstimate } from '~/types'
import { canonicalizeProcessCommand, isOcrCommand, isSttCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isDocumentByExtension, isLikelyUrl } from './target-utils'
import { resolveLLMDefaults } from './llm-defaults'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { InputKind } from '~/types'


const MEDIA_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.opus', '.ogg', '.aac', '.mov', '.flac']
const isMediaByExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return MEDIA_EXTENSIONS.some(ext => lower.endsWith(ext))
}

const isDocumentUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return isDocumentByExtension(pathname)
  } catch {
    return false
  }
}

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return isMediaByExtension(pathname)
  } catch {
    return false
  }
}

const isStreamingUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes('youtube.com')
      || host.includes('youtu.be')
      || host.includes('twitch.tv')
      || host.includes('tiktok.com')
  } catch {
    return false
  }
}

const classifyUrlInput = (url: string): InputKind => {
  if (isDocumentUrl(url)) {
    return 'url_direct_document'
  }
  if (isDirectMediaUrl(url)) {
    return 'url_direct_media'
  }
  if (isStreamingUrl(url)) {
    return 'url_streaming'
  }
  return 'url_streaming'
}

const extensionFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.pdf')) return '.pdf'
    if (pathname.endsWith('.epub')) return '.epub'
    if (pathname.endsWith('.docx')) return '.docx'
    if (pathname.endsWith('.pptx')) return '.pptx'
    if (pathname.endsWith('.xlsx')) return '.xlsx'
    if (pathname.endsWith('.odt')) return '.odt'
    if (pathname.endsWith('.ods')) return '.ods'
    if (pathname.endsWith('.odp')) return '.odp'
    if (pathname.endsWith('.png')) return '.png'
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return '.jpg'
    if (pathname.endsWith('.tif') || pathname.endsWith('.tiff')) return '.tif'
  } catch {
  }

  return '.pdf'
}

const downloadDocumentUrlToTempFile = async (
  url: string
): Promise<{ filePath: string, cleanup: () => Promise<void> }> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download document URL: ${url} (${response.status})`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-doc-url-'))
  const ext = extensionFromUrl(url)
  const filePath = join(tempDir, `document${ext}`)
  const bytes = await response.arrayBuffer()
  await Bun.write(filePath, bytes)

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

const estimateTokens = (text: string): number => text.split(/\s+/).filter(Boolean).length

const hasExplicitLlmProvider = (opts: RuntimeOptions): boolean => {
  return [
    opts.openaiModel,
    opts.groqModel,
    opts.geminiModel,
    opts.anthropicModel,
    opts.minimaxModel,
    opts.llamaModel
  ].some((model) => typeof model === 'string' && model.length > 0)
}

const toDocumentSourceUrl = (target: string): string => {
  if (isLikelyUrl(target)) {
    return target
  }

  return `file://${pathResolve(target)}`
}

const buildExtractionCallOpts = (target: string, baseDir: string, opts: RuntimeOptions): Partial<ExtractionOptions> => {
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || './output',
    dpi: opts.dpi,
    languages: opts.lang,
    oem: opts.oem,
    psm: opts.psm,
    outputFormat: opts.out,
    preserveInterwordSpaces: opts.preserveSpaces,
    rotate: opts.rotate
  }

  if (opts.password) {
    extractionOpts.password = opts.password
  }
  if (opts.pageSeparator) {
    extractionOpts.pageSeparator = opts.pageSeparator
  }
  if (opts.useOcrmypdf) {
    extractionOpts.useOcrmypdf = true
  }
  if (opts.usePaddleOcr) {
    extractionOpts.usePaddleOcr = true
  }
  if (opts.mistralOcrModel) {
    extractionOpts.mistralOcrModel = opts.mistralOcrModel
  }
  if (opts.useEpubBun) {
    extractionOpts.useEpubBun = true
  }
  if (opts.useEpubCalibre) {
    extractionOpts.useEpubCalibre = true
  }

  return extractionOpts
}

const runDocumentWrite = async (target: string, baseDir: string, opts: RuntimeOptions): Promise<{ outputDir: string }> => {
  const llmConfig = resolveLLMDefaults(opts)
  const extraction = await processDocument(target, buildExtractionCallOpts(target, baseDir, opts))

  const useLegacyFallback = opts.structured === false && !hasExplicitLlmProvider(opts)
  if (useLegacyFallback) {
    const instruction = await resolvePromptNames(opts.prompts ?? [], {
      exampleFormat: 'markdown'
    })
    const prompt = buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
    const promptPath = `${extraction.outputDir}/prompt.md`
    await Bun.write(promptPath, prompt)

    const textWords = extraction.result.text.split(/\s+/).filter(Boolean)
    const summary = `# Summary\n\n${textWords.slice(0, 220).join(' ')}`
    const summaryPath = `${extraction.outputDir}/text.md`
    await Bun.write(summaryPath, summary)

    const llmModel = llmConfig.useOpenAI
      ? (llmConfig.openaiModel as string)
      : llmConfig.useGroq
        ? (llmConfig.groqModel as string)
        : llmConfig.useGemini
          ? (llmConfig.geminiModel as string)
          : llmConfig.useAnthropic
            ? (llmConfig.anthropicModel as string)
            : llmConfig.useMinimax
              ? (llmConfig.minimaxModel as string)
              : (llmConfig.llamaModel as string)
    const llmService: Step3Metadata['llmService'] = llmConfig.useOpenAI
      ? 'openai'
      : llmConfig.useGroq
        ? 'groq'
        : llmConfig.useGemini
          ? 'gemini'
          : llmConfig.useAnthropic
            ? 'anthropic'
            : llmConfig.useMinimax
              ? 'minimax'
              : 'llama.cpp'
    const step3: Step3Metadata = {
      llmService,
      llmModel,
      processingTime: 0,
      inputTokenCount: estimateTokens(prompt),
      outputTokenCount: estimateTokens(summary),
      outputFileName: 'text.md',
      outputFormat: 'markdown',
      structuredMode: 'off',
      structuredPresetNames: []
    }

    const estimated = computeEstimatedCosts({
      mistralOcrModel: opts.mistralOcrModel,
      extractPageCount: extraction.step1Metadata.pageCount,
      llmService,
      llmModel,
      llmInputTokenCount: step3.inputTokenCount,
      llmOutputTokenCount: step3.outputTokenCount,
      skipLLM: false
    })
    const actual = computeActualCosts({ step2: extraction.step2Metadata, step3 })
    const cost = { estimated, actual }

    const estimatedTiming = computeEstimatedProcessingTimes({
      mistralOcrModel: opts.mistralOcrModel,
      extractPageCount: extraction.step1Metadata.pageCount,
      llmService,
      llmModel,
      llmInputTokenCount: step3.inputTokenCount,
      llmOutputTokenCount: step3.outputTokenCount,
      skipLLM: false,
    })
    const actualTiming = computeActualProcessingTimes({
      step1: extraction.step1Metadata,
      step2: extraction.step2Metadata,
      step3,
    })
    const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
      ? { estimated: estimatedTiming, actual: actualTiming }
      : undefined

    await writeFile(`${extraction.outputDir}/metadata.json`, JSON.stringify({
      step1: extraction.step1Metadata,
      step2: extraction.step2Metadata,
      step3,
      cost,
      ...(timing ? { timing } : {}),
    }, null, 2))

    l.report.complete(extraction.outputDir, { prompt: 'prompt.md', summary: 'text.md', metadata: 'metadata.json' })
    return { outputDir: extraction.outputDir }
  }

  const documentMeta: VideoMetadata = {
    title: extraction.step1Metadata.title ?? 'Document',
    duration: 'Unknown',
    author: extraction.step1Metadata.author ?? 'Unknown',
    description: '',
    url: toDocumentSourceUrl(target)
  }
  const transcriptionLike: TranscriptionResult = {
    text: extraction.result.text,
    segments: [{
      start: '00:00:00',
      end: '00:00:00',
      text: extraction.result.text
    }]
  }

  const step3Runs = await runLLM(documentMeta, transcriptionLike, {
    outputDir: extraction.outputDir,
    prompts: opts.prompts,
    useOpenAI: llmConfig.useOpenAI,
    openaiModel: llmConfig.openaiModel,
    groqModel: llmConfig.groqModel,
    useGemini: llmConfig.useGemini,
    geminiModel: llmConfig.geminiModel,
    useAnthropic: llmConfig.useAnthropic,
    anthropicModel: llmConfig.anthropicModel,
    minimaxModel: llmConfig.minimaxModel,
    llamaModel: llmConfig.llamaModel,
    structured: opts.structured,
    structuredStrict: opts.structuredStrict,
    structuredCompatRetries: opts.structuredCompatRetries,
    promptBuilder: (instruction: string) =>
      buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
  })

  const step3Results = step3Runs.map((entry) => entry.metadata)
  if (step3Results.length === 0) {
    throw new Error('No LLM outputs generated for document write')
  }

  const step3Serialized = step3Results.length === 1 ? step3Results[0] : step3Results
  const llmInputTokenCount = step3Results.reduce((sum, item) => sum + item.inputTokenCount, 0)
  const llmOutputTokenCount = step3Results.reduce((sum, item) => sum + item.outputTokenCount, 0)
  const llmService = step3Results[0]?.llmService ?? 'llama.cpp'
  const llmModel = step3Results[0]?.llmModel ?? (llmConfig.llamaModel ?? 'unknown')

  const estimated = computeEstimatedCosts({
    mistralOcrModel: opts.mistralOcrModel,
    extractPageCount: extraction.step1Metadata.pageCount,
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    skipLLM: false
  })
  const actual = computeActualCosts({ step2: extraction.step2Metadata, step3: step3Serialized })
  const cost = { estimated, actual }

  const estimatedTiming = computeEstimatedProcessingTimes({
    mistralOcrModel: opts.mistralOcrModel,
    extractPageCount: extraction.step1Metadata.pageCount,
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    skipLLM: false,
  })
  const actualTiming = computeActualProcessingTimes({
    step1: extraction.step1Metadata,
    step2: extraction.step2Metadata,
    step3: step3Serialized,
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  await writeFile(`${extraction.outputDir}/metadata.json`, JSON.stringify({
    step1: extraction.step1Metadata,
    step2: extraction.step2Metadata,
    step3: step3Serialized,
    cost,
    ...(timing ? { timing } : {}),
  }, null, 2))

  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    metadata: 'metadata.json'
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.md'
  } else {
    for (const step3 of step3Results) {
      artifactFiles[`summary-${step3.llmModel}`] = step3.outputFileName
    }
  }
  l.report.complete(extraction.outputDir, artifactFiles)
  return { outputDir: extraction.outputDir }
}

const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelUrl?: string, publishDate?: string, duration: string } }> => {
  const llmConfig = resolveLLMDefaults(llmDefaults)

  if (llmDefaults.split) {
    l.info('Audio will be split into 10-minute segments for transcription')
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

  const baseOptions: Record<string, unknown> = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    whisperModel: llmDefaults.whisperModel,
    groqSttModel: llmDefaults.groqSttModel,
    elevenlabsSttModel: llmDefaults.elevenlabsSttModel,
    openaiSttModel: llmDefaults.openaiSttModel,
    mistralSttModel: llmDefaults.mistralSttModel,
    assemblyaiSttModel: llmDefaults.assemblyaiSttModel,
    diarizationSpeakerCount: llmDefaults.diarizationSpeakerCount,
    llamaModel: llmConfig.llamaModel,
    openaiModel: llmConfig.openaiModel,
    groqModel: llmConfig.groqModel,
    geminiModel: llmConfig.geminiModel,
    anthropicModel: llmConfig.anthropicModel,
    minimaxModel: llmConfig.minimaxModel,
    outputDir: baseDir,
    useReverb: llmDefaults.useReverb,
    useOpenAI: llmConfig.useOpenAI,
    useGemini: llmConfig.useGemini,
    useAnthropic: llmConfig.useAnthropic,
    reverbVerbatimicity: llmDefaults.reverbVerbatimicity,
    split: llmDefaults.split,
    skipLLM: llmDefaults.skipLLM,
    structured: llmDefaults.structured,
    structuredStrict: llmDefaults.structuredStrict,
    structuredCompatRetries: llmDefaults.structuredCompatRetries,
    prompts: llmDefaults.prompts,
    ttsSpeaker: llmDefaults.ttsSpeaker,
    kittenTtsModel: llmDefaults.kittenTtsModel,
    groqTtsModel: llmDefaults.groqTtsModel,
    groqVoiceId: llmDefaults.groqVoiceId,
    openaiTtsModel: llmDefaults.openaiTtsModel,
    openaiVoiceId: llmDefaults.openaiVoiceId,
    geminiTtsModel: llmDefaults.geminiTtsModel,
    geminiVoiceId: llmDefaults.geminiVoiceId,
    elevenlabsTtsModel: llmDefaults.elevenlabsTtsModel,
    elevenlabsVoiceId: llmDefaults.elevenlabsVoiceId,
    minimaxTtsModel: llmDefaults.minimaxTtsModel,
    minimaxTtsVoice: llmDefaults.minimaxTtsVoice,
    geminiImageModel: llmDefaults.geminiImageModel,
    openaiImageModel: llmDefaults.openaiImageModel,
    minimaxImageModel: llmDefaults.minimaxImageModel,
    imageAspectRatio: llmDefaults.imageAspectRatio,
    imageSize: llmDefaults.imageSize,
    imageQuality: llmDefaults.imageQuality,
    imageFormat: llmDefaults.imageFormat,
    imageBackground: llmDefaults.imageBackground,
    imagenCount: llmDefaults.imagenCount,
    elevenlabsMusicModel: llmDefaults.elevenlabsMusicModel,
    minimaxMusicModel: llmDefaults.minimaxMusicModel,
    musicDuration: llmDefaults.musicDuration,
    musicLyricsFile: llmDefaults.musicLyricsFile,
    musicInstrumental: llmDefaults.musicInstrumental,
    soraVideoModel: llmDefaults.soraVideoModel,
    geminiVideoModel: llmDefaults.geminiVideoModel,
    minimaxVideoModel: llmDefaults.minimaxVideoModel,
    videoDuration: llmDefaults.videoDuration,
    videoSize: llmDefaults.videoSize,
    videoAspectRatio: llmDefaults.videoAspectRatio,
    videoResolution: llmDefaults.videoResolution,
    mistralOcrModel: llmDefaults.mistralOcrModel
  }

  const options: ProcessingOptions = validateData(ProcessingOptionsSchema, baseOptions, 'processing options')

  const outDir = await processVideo(options, meta, preflightEstimate)
  const baseInfo: { url: string, title: string, channel: string, duration: string, channelUrl?: string, publishDate?: string } = {
    url: srcUrl,
    title: meta.title,
    channel: meta.author,
    duration: meta.duration
  }

  if (meta.channelUrl) {
    baseInfo.channelUrl = meta.channelUrl
  }
  if (meta.publishDate) {
    baseInfo.publishDate = meta.publishDate
  }

  return { outputDir: outDir, info: baseInfo }
}

const processExtractSingle = async (target: string, baseDir: string, opts: RuntimeOptions): Promise<{ outputDir: string }> => {
  const extraction = await processDocument(target, buildExtractionCallOpts(target, baseDir, opts))
  l.success(`Extraction complete: ${extraction.outputDir}`)
  return { outputDir: extraction.outputDir }
}

const processMetadataMedia = async (
  target: string,
  save: boolean,
  baseDir: string
): Promise<void> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) src.url = target
  if (!isUrl && exists) src.filePath = target

  const meta = await extractSourceMetadata(src)

  const metadata = {
    title: meta.title,
    duration: meta.duration,
    author: meta.author,
    url: meta.url,
    ...(meta.publishDate ? { publishDate: meta.publishDate } : {}),
    ...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
    ...(meta.channelUrl ? { channelUrl: meta.channelUrl } : {}),
    ...(meta.chapters?.length ? { chapters: meta.chapters } : {}),
    ...(meta.description?.length ? { description: meta.description } : {})
  }

  console.log(JSON.stringify(metadata, null, 2))

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : './output'
  const uniqueDirName = createUniqueDirectoryName(meta.title)
  const outputDir = `${effectiveBaseDir}/${uniqueDirName}`
  await ensureDirectory(outputDir)
  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ step1: metadata }, null, 2))
  if (save) {
    l.report.complete(outputDir, { metadata: 'metadata.json' })
  }
}

const processMetadataDocument = async (
  target: string,
  save: boolean,
  baseDir: string,
  password?: string
): Promise<void> => {
  const detectedFormat = await detectDocumentFormat(target)
  if (!detectedFormat) {
    throw CLIUsageError(`Unsupported document format: ${target}`)
  }

  let pageCount = 1
  let title = basename(target).replace(/\.[^.]+$/, '')
  let author: string | undefined

  if (detectedFormat === 'pdf' || detectedFormat === 'epub') {
    const info = await getDocumentInfo(target, password)
    pageCount = Math.max(1, info.pageCount)
    if (info.title?.length) title = info.title
    if (info.author?.length) author = info.author
  }

  const stats = await stat(target)
  const metadata = {
    format: detectedFormat,
    title,
    ...(author ? { author } : {}),
    pageCount,
    fileSize: stats.size
  }

  console.log(JSON.stringify(metadata, null, 2))

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : './output'
  const uniqueDirName = createUniqueDirectoryName(title)
  const outputDir = `${effectiveBaseDir}/${uniqueDirName}`
  await ensureDirectory(outputDir)
  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ step1: metadata }, null, 2))
  if (save) {
    l.report.complete(outputDir, { metadata: 'metadata.json' })
  }
}

const processDownloadMedia = async (
  target: string,
  baseDir: string
): Promise<{ outputDir: string }> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = await extractSourceMetadata(src)
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const uniqueDirName = createUniqueDirectoryName(meta.title)
  const outputDir = `${effectiveBaseDir}/${uniqueDirName}`
  await ensureDirectory(outputDir)

  const dlOpts = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    outputDir
  }

  const { metadata: step1Metadata } = await downloadAudio(dlOpts, meta)

  const cost = {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ step1: step1Metadata, cost }, null, 2))

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, metadata: 'metadata.json' })

  return { outputDir }
}

const processDownloadDocument = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions
): Promise<{ outputDir: string }> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const prepared = await downloadDocument(target, effectiveBaseDir, opts.password)

  const cost = {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }

  const metadataPath = `${prepared.outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ step1: prepared.step1Metadata, cost }, null, 2))

  l.report.complete(prepared.outputDir, { metadata: 'metadata.json' })

  return { outputDir: prepared.outputDir }
}

export const processSingleTarget = async (
  command: ProcessCommand,
  item: string,
  baseDir: string,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<void> => {
  const displayCommand = canonicalizeProcessCommand(command)

  if (command === 'metadata') {
    if (isLikelyUrl(item)) {
      const kind = classifyUrlInput(item)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          await processMetadataDocument(downloaded.filePath, opts.save, baseDir, opts.password)
        } finally {
          await downloaded.cleanup()
        }
        return
      }
      await processMetadataMedia(item, opts.save, baseDir)
      return
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help metadata`)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      await processMetadataDocument(item, opts.save, baseDir, opts.password)
    } else {
      await processMetadataMedia(item, opts.save, baseDir)
    }
    return
  }

  if (command === 'download') {
    if (isLikelyUrl(item)) {
      const kind = classifyUrlInput(item)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          await processDownloadDocument(downloaded.filePath, baseDir, opts)
        } finally {
          await downloaded.cleanup()
        }
        return
      }
      await processDownloadMedia(item, baseDir)
      return
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help download`)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      await processDownloadDocument(item, baseDir, opts)
    } else {
      await processDownloadMedia(item, baseDir)
    }
    return
  }

  if (isLikelyUrl(item)) {
    const kind = classifyUrlInput(item)
    if (kind === 'url_direct_document') {
      if (isSttCommand(command)) {
        throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
      }

      const downloaded = await downloadDocumentUrlToTempFile(item)
      try {
        if (isOcrCommand(command)) {
          await processExtractSingle(downloaded.filePath, baseDir, opts)
        } else {
          await runDocumentWrite(downloaded.filePath, baseDir, opts)
        }
      } finally {
        await downloaded.cleanup()
      }
      return
    }

    if (isOcrCommand(command)) {
      throw CLIUsageError(`Unsupported ocr input "${item}". Use a direct document URL or local file.`)
    }

    await processMediaSingle(item, baseDir, opts, preflightEstimate)
    return
  }

  const exists = await fileExists(item)
  if (!exists) {
    throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help ${displayCommand}`)
  }

  const isDocExt = isDocumentByExtension(item)
  const detected = isDocExt ? await detectDocumentFormat(item) : null
  const kind: InputKind = (isDocExt || detected !== null) ? 'local_document' : 'local_media'

  if (isOcrCommand(command)) {
    if (kind !== 'local_document') {
      l.warn(`Skipping non-document file in ocr mode: ${item}`)
      return
    }
    await processExtractSingle(item, baseDir, opts)
    return
  }

  if (command === 'write' && kind === 'local_document') {
    await runDocumentWrite(item, baseDir, opts)
    return
  }

  if (isSttCommand(command) && kind === 'local_document') {
    throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
  }

  await processMediaSingle(item, baseDir, opts, preflightEstimate)
}

export const handleSingleTarget = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<void> => {
  await processSingleTarget(command, resolvedTarget, '', opts, preflightEstimate)
}
