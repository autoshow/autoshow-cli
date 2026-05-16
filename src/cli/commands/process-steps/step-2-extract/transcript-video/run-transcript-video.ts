import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { readRunManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { getOutputRootAbsolute, joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import { formatSrt, formatVtt } from '~/cli/commands/process-steps/step-7-music/lyrics-video/captions'
import {
  FIXED_RENDER_FPS,
  FIXED_RENDER_HEIGHT,
  FIXED_RENDER_WIDTH,
  buildTranscriptAss,
  extractTitle,
  findMatchingImage,
  renderLyricsVideo
} from '~/cli/commands/process-steps/step-7-music/lyrics-video/render'
import { parseStoredTranscriptionResult } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import type { CaptionCue, ProviderResult, RunManifest, TranscriptionResult } from '~/types'

type TranscriptCue = CaptionCue & {
  speaker?: string | undefined
}

type TranscriptCueSource = 'extract-evidence-segments' | 'extract-result-segments' | 'transcript-text'

type LoadedTranscription = {
  result: TranscriptionResult
  source: 'result-json' | 'transcript-text'
  sourcePath: string
  provider?: string | undefined
  model?: string | undefined
}

type TranscriptVideoSource = {
  audioPath: string
  transcription: LoadedTranscription
  title: string
  label: string
  extractRunDir?: string | undefined
}

const PROJECT_ROOT = resolve(import.meta.dir, '../../../../../../')
const OUTPUT_ROOT = getOutputRootAbsolute(PROJECT_ROOT)
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'])
const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/
const MAX_TRANSCRIPT_WORDS_PER_CUE = 12
const MAX_TRANSCRIPT_CHARACTERS_PER_CUE = 78

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPosixPath = (value: string): string =>
  value.replace(/\\/g, '/')

const toProjectDisplayPath = (absolutePath: string): string => {
  const rel = relative(PROJECT_ROOT, absolutePath)
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) {
    return absolutePath
  }

  return toPosixPath(rel)
}

const resolveUserPath = (value: string): string =>
  resolve(PROJECT_ROOT, value)

const baseStem = (filePath: string): string =>
  basename(filePath, extname(filePath))

const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim()

const splitTranscriptText = (text: string): string[] => {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return []
  }

  const chunks: string[] = []
  let currentWords: string[] = []

  const flush = (): void => {
    if (currentWords.length === 0) {
      return
    }
    chunks.push(currentWords.join(' '))
    currentWords = []
  }

  for (const word of words) {
    const projected = currentWords.length === 0 ? word : `${currentWords.join(' ')} ${word}`
    if (
      currentWords.length > 0
      && (
        currentWords.length >= MAX_TRANSCRIPT_WORDS_PER_CUE
        || projected.length > MAX_TRANSCRIPT_CHARACTERS_PER_CUE
      )
    ) {
      flush()
    }

    currentWords.push(word)

    if (
      currentWords.length >= 6
      && (
        /[.!?]$/.test(word)
        || (currentWords.length >= 8 && /[,;:]$/.test(word))
      )
    ) {
      flush()
    }
  }

  flush()
  return chunks
}

const splitTranscriptCue = (cue: TranscriptCue): TranscriptCue[] => {
  const chunks = splitTranscriptText(cue.text)
  if (chunks.length <= 1) {
    return [{
      ...cue,
      text: chunks[0] ?? cue.text
    }]
  }

  const cueDuration = Math.max(cue.end - cue.start, 0.1)
  const weights = chunks.map((chunk) => Math.max(1, chunk.split(/\s+/).filter(Boolean).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let elapsedWeight = 0

  return chunks.map((chunk, index) => {
    const startWeight = elapsedWeight
    elapsedWeight += weights[index] ?? 1
    return {
      ...cue,
      index: 0,
      start: cue.start + (cueDuration * startWeight / totalWeight),
      end: cue.start + (cueDuration * elapsedWeight / totalWeight),
      text: chunk
    }
  })
}

const expandTranscriptCues = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] =>
  repairCueDurations(cues, audioDurationSeconds)
    .flatMap(splitTranscriptCue)
    .map((cue, index) => ({ ...cue, index }))

const parseTimestampToSeconds = (timestamp: string): number => {
  const match = timestamp.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:([.,])(\d{1,3}))?$/)
  if (!match) {
    return Number.NaN
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = match[5] ? Number(match[5].padEnd(3, '0')) : 0

  if (
    !Number.isFinite(hours)
    || !Number.isFinite(minutes)
    || !Number.isFinite(seconds)
    || !Number.isFinite(milliseconds)
    || minutes > 59
    || seconds > 59
  ) {
    return Number.NaN
  }

  return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000)
}

const repairCueDurations = (
  cues: TranscriptCue[],
  audioDurationSeconds?: number | undefined
): TranscriptCue[] => cues.map((cue, index) => {
  const nextCue = cues[index + 1]
  let end = cue.end

  if (!Number.isFinite(end) || end <= cue.start) {
    if (nextCue && nextCue.start > cue.start) {
      end = nextCue.start
    } else if (audioDurationSeconds !== undefined && audioDurationSeconds > cue.start) {
      end = audioDurationSeconds
    } else {
      end = cue.start + 2.5
    }
  }

  return {
    ...cue,
    end: Math.max(end, cue.start + 0.1)
  }
}).filter((cue) => cue.end > cue.start)

const buildCuesFromTranscriptionResult = (
  result: TranscriptionResult
): { cues: TranscriptCue[], cueSource: TranscriptCueSource } => {
  const evidenceSegments = result.evidence?.segments ?? []
  if (evidenceSegments.length > 0) {
    const cues = evidenceSegments
      .map((segment) => ({
        index: 0,
        start: segment.startSeconds,
        end: segment.endSeconds,
        text: normalizeText(segment.text),
        ...(segment.speaker ? { speaker: segment.speaker } : {})
      }))
      .filter((cue) =>
        Number.isFinite(cue.start)
        && Number.isFinite(cue.end)
        && cue.text.length > 0
      )
      .sort((left, right) => left.start - right.start || left.end - right.end)
      .map((cue, index) => ({ ...cue, index }))

    if (cues.length > 0) {
      return { cues: expandTranscriptCues(cues), cueSource: 'extract-evidence-segments' }
    }
  }

  const cues = result.segments
    .map((segment) => ({
      index: 0,
      start: parseTimestampToSeconds(segment.start),
      end: parseTimestampToSeconds(segment.end),
      text: normalizeText(segment.text),
      ...(segment.speaker ? { speaker: segment.speaker } : {})
    }))
    .filter((cue) =>
      Number.isFinite(cue.start)
      && Number.isFinite(cue.end)
      && cue.text.length > 0
    )
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .map((cue, index) => ({ ...cue, index }))

  return { cues: expandTranscriptCues(cues), cueSource: 'extract-result-segments' }
}

const buildCuesFromTranscriptText = (
  transcriptText: string,
  audioDurationSeconds?: number | undefined
): { result: TranscriptionResult, cues: TranscriptCue[] } => {
  const parsed: Array<Omit<TranscriptCue, 'index' | 'end'> & { end?: number | undefined }> = []

  for (const rawLine of transcriptText.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const text = normalizeText(match[3] ?? '')
    const start = parseTimestampToSeconds(match[1]!)
    if (!Number.isFinite(start) || text.length === 0) {
      continue
    }

    parsed.push({
      start,
      text,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0 ? { speaker: match[2].trim() } : {})
    })
  }

  if (parsed.length === 0) {
    throw new Error('Transcript text contained no timestamped lines in [HH:MM:SS] format')
  }

  const cues = parsed.map((cue, index) => ({
    ...cue,
    index,
    end: parsed[index + 1]?.start ?? audioDurationSeconds ?? cue.start + 2.5
  }))

  const repaired = expandTranscriptCues(cues, audioDurationSeconds)
  return {
    result: {
      text: repaired.map((cue) => cue.text).join(' ').trim(),
      segments: repaired.map((cue) => ({
        start: formatCueTimestamp(cue.start),
        end: formatCueTimestamp(cue.end),
        text: cue.text,
        ...(cue.speaker ? { speaker: cue.speaker } : {})
      }))
    },
    cues: repaired
  }
}

const formatCueTimestamp = (seconds: number): string => {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000))
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

const toCaptionCuesWithSpeakerLabels = (cues: TranscriptCue[]): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.speaker ? `${cue.speaker}: ${cue.text}` : cue.text
  }))

const collectSpeakerInventory = (cues: TranscriptCue[]): string[] => {
  const speakers: string[] = []
  const seen = new Set<string>()
  for (const cue of cues) {
    if (!cue.speaker || seen.has(cue.speaker)) {
      continue
    }
    seen.add(cue.speaker)
    speakers.push(cue.speaker)
  }
  return speakers
}

const parseProviderResultFile = (value: unknown): Pick<ProviderResult, 'provider' | 'model' | 'result'> | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || value['kind'] !== 'provider-result'
    || typeof value['provider'] !== 'string'
    || !isRecord(value['result'])
  ) {
    return undefined
  }

  return {
    provider: value['provider'],
    ...(typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    result: value['result']
  }
}

const loadTranscriptionResultJson = async (resultPath: string): Promise<LoadedTranscription> => {
  const raw = await Bun.file(resultPath).json() as unknown
  const envelope = parseProviderResultFile(raw)
  const parsed = parseStoredTranscriptionResult(envelope?.result ?? raw)
  if (!parsed) {
    throw new Error(`Transcript result file is not a supported STT result: ${toProjectDisplayPath(resultPath)}`)
  }

  return {
    result: parsed,
    source: 'result-json',
    sourcePath: resultPath,
    ...(envelope?.provider ? { provider: envelope.provider } : {}),
    ...(envelope?.model ? { model: envelope.model } : {})
  }
}

const loadTranscriptText = async (
  transcriptPath: string,
  audioDurationSeconds?: number | undefined
): Promise<{ transcription: LoadedTranscription, cues: TranscriptCue[] }> => {
  const raw = await Bun.file(transcriptPath).text()
  const { result, cues } = buildCuesFromTranscriptText(raw, audioDurationSeconds)
  return {
    transcription: {
      result,
      source: 'transcript-text',
      sourcePath: transcriptPath
    },
    cues
  }
}

const resolveAudioFromExtractRun = async (
  runDir: string,
  manifest: RunManifest
): Promise<string> => {
  const step1 = isRecord(manifest.metadata['step1']) ? manifest.metadata['step1'] : undefined
  const fileNames = [
    typeof step1?.['audioFileName'] === 'string' ? step1['audioFileName'] : undefined,
    typeof step1?.['mediaFileName'] === 'string' ? step1['mediaFileName'] : undefined
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  for (const fileName of fileNames) {
    const candidate = join(runDir, fileName)
    if (await fileExists(candidate)) {
      return candidate
    }
  }

  const entries = await readdir(runDir, { withFileTypes: true })
  const audioFiles = entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(runDir, entry.name))
    .sort()

  if (audioFiles.length === 1) {
    return audioFiles[0]!
  }

  throw CLIUsageError(`Could not infer extract audio file from ${toProjectDisplayPath(runDir)}. Pass --audio explicitly.`)
}

const getProviderStateResultCandidates = async (
  runDir: string,
  manifest: RunManifest
): Promise<string[]> => {
  const candidates: string[] = []
  const providerStates = Array.isArray(manifest.metadata['providerStates'])
    ? manifest.metadata['providerStates'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []

  for (const state of providerStates) {
    if (state['status'] !== 'succeeded' || typeof state['artifactDir'] !== 'string') {
      continue
    }
    const candidate = join(runDir, state['artifactDir'], 'result.json')
    if (await fileExists(candidate)) {
      candidates.push(candidate)
    }
  }

  const providersDir = join(runDir, 'providers')
  if (await fileExists(providersDir)) {
    const entries = await readdir(providersDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      const candidate = join(providersDir, entry.name, 'result.json')
      if (await fileExists(candidate) && !candidates.includes(candidate)) {
        candidates.push(candidate)
      }
    }
  }

  return candidates.sort()
}

const resolveResultFromExtractRun = async (
  runDir: string,
  manifest: RunManifest
): Promise<string> => {
  const rootResult = join(runDir, 'result.json')
  if (await fileExists(rootResult)) {
    return rootResult
  }

  const candidates = await getProviderStateResultCandidates(runDir, manifest)
  if (candidates.length === 1) {
    return candidates[0]!
  }

  if (candidates.length > 1) {
    throw CLIUsageError(`Multiple STT result files found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result to choose one.`)
  }

  throw CLIUsageError(`No STT result.json found in ${toProjectDisplayPath(runDir)}. Pass --transcript-result or --transcript-text explicitly.`)
}

const resolveTitleFromExtractRun = (manifest: RunManifest, audioPath: string): string => {
  const step1 = isRecord(manifest.metadata['step1']) ? manifest.metadata['step1'] : undefined
  const title = typeof step1?.['title'] === 'string' && step1['title'].trim().length > 0
    ? step1['title'].trim()
    : undefined
  return title ?? extractTitle(audioPath)
}

const resolveExtractRunSource = async (
  inputPath: string,
  flags: Record<string, unknown>
): Promise<TranscriptVideoSource> => {
  const runDir = resolveUserPath(inputPath)
  const manifest = await readRunManifest(runDir, 'extract')
  if (!manifest || manifest.metadata['extractRoute'] !== 'media') {
    throw CLIUsageError(`Transcript video input must be a media extract output directory: ${toProjectDisplayPath(runDir)}`)
  }

  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const resultFlag = typeof flags['transcript-result'] === 'string' ? flags['transcript-result'] : undefined
  const textFlag = typeof flags['transcript-text'] === 'string' ? flags['transcript-text'] : undefined
  if (resultFlag && textFlag) {
    throw CLIUsageError('Use only one of --transcript-result or --transcript-text')
  }

  const audioPath = audioFlag ? resolveUserPath(audioFlag) : await resolveAudioFromExtractRun(runDir, manifest)
  if (!await fileExists(audioPath)) {
    throw new Error(`Audio file not found: ${toProjectDisplayPath(audioPath)}`)
  }

  if (textFlag) {
    const transcriptPath = resolveUserPath(textFlag)
    if (!await fileExists(transcriptPath)) {
      throw new Error(`Transcript text file not found: ${toProjectDisplayPath(transcriptPath)}`)
    }
    const audioDurationSeconds = await getAudioDuration(audioPath).catch(() => undefined)
    const loaded = await loadTranscriptText(transcriptPath, audioDurationSeconds)
    return {
      audioPath,
      transcription: loaded.transcription,
      title: resolveTitleFromExtractRun(manifest, audioPath),
      label: baseStem(transcriptPath),
      extractRunDir: runDir
    }
  }

  const resultPath = resultFlag ? resolveUserPath(resultFlag) : await resolveResultFromExtractRun(runDir, manifest)
  if (!await fileExists(resultPath)) {
    throw new Error(`Transcript result file not found: ${toProjectDisplayPath(resultPath)}`)
  }

  return {
    audioPath,
    transcription: await loadTranscriptionResultJson(resultPath),
    title: resolveTitleFromExtractRun(manifest, audioPath),
    label: baseStem(audioPath),
    extractRunDir: runDir
  }
}

const resolveManualSource = async (flags: Record<string, unknown>): Promise<TranscriptVideoSource> => {
  const audioFlag = typeof flags['audio'] === 'string' ? flags['audio'] : undefined
  const resultFlag = typeof flags['transcript-result'] === 'string' ? flags['transcript-result'] : undefined
  const textFlag = typeof flags['transcript-text'] === 'string' ? flags['transcript-text'] : undefined

  if (!audioFlag) {
    throw CLIUsageError('Manual transcript-video mode requires --audio')
  }
  if ((resultFlag ? 1 : 0) + (textFlag ? 1 : 0) !== 1) {
    throw CLIUsageError('Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text')
  }

  const audioPath = resolveUserPath(audioFlag)
  if (!await fileExists(audioPath)) {
    throw new Error(`Audio file not found: ${toProjectDisplayPath(audioPath)}`)
  }

  if (textFlag) {
    const transcriptPath = resolveUserPath(textFlag)
    if (!await fileExists(transcriptPath)) {
      throw new Error(`Transcript text file not found: ${toProjectDisplayPath(transcriptPath)}`)
    }
    const audioDurationSeconds = await getAudioDuration(audioPath).catch(() => undefined)
    const loaded = await loadTranscriptText(transcriptPath, audioDurationSeconds)
    return {
      audioPath,
      transcription: loaded.transcription,
      title: extractTitle(audioPath),
      label: baseStem(transcriptPath)
    }
  }

  const resultPath = resolveUserPath(resultFlag!)
  if (!await fileExists(resultPath)) {
    throw new Error(`Transcript result file not found: ${toProjectDisplayPath(resultPath)}`)
  }

  return {
    audioPath,
    transcription: await loadTranscriptionResultJson(resultPath),
    title: extractTitle(audioPath),
    label: baseStem(audioPath)
  }
}

const resolveTranscriptVideoSource = async (
  inputPath: string | undefined,
  flags: Record<string, unknown>
): Promise<TranscriptVideoSource> =>
  inputPath
    ? await resolveExtractRunSource(inputPath, flags)
    : await resolveManualSource(flags)

const processTranscriptVideoRun = async (
  source: TranscriptVideoSource,
  options: {
    outputDirAbsolute: string
    outputDirRelative: string
    font: string
    keepTmp: boolean
  }
): Promise<void> => {
  const startedAt = Date.now()
  const tempDir = join(options.outputDirAbsolute, '.transcript-video-tmp')
  const assPath = join(tempDir, 'transcript.ass')
  const renderedVideoPath = join(tempDir, 'out.mp4')
  const videoFileName = `${source.label}.mp4`
  const vttFileName = `${source.label}.vtt`
  const srtFileName = `${source.label}.srt`
  const videoPath = join(options.outputDirAbsolute, videoFileName)
  const imagePath = await findMatchingImage(source.audioPath, dirname(source.audioPath))

  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })

  try {
    const cueBuildStartedAt = Date.now()
    const built = buildCuesFromTranscriptionResult(source.transcription.result)
    const cues = built.cues
    const cueSource = source.transcription.source === 'transcript-text' ? 'transcript-text' : built.cueSource
    if (cues.length === 0) {
      throw new Error('Transcript contained no usable timestamped cues')
    }
    const cueBuildMs = Date.now() - cueBuildStartedAt

    const captionCues = toCaptionCuesWithSpeakerLabels(cues)
    const captionWriteStartedAt = Date.now()
    await Promise.all([
      Bun.write(join(options.outputDirAbsolute, vttFileName), formatVtt(captionCues)),
      Bun.write(join(options.outputDirAbsolute, srtFileName), formatSrt(captionCues))
    ])
    const captionsWriteMs = Date.now() - captionWriteStartedAt

    await Bun.write(assPath, buildTranscriptAss({
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      font: options.font,
      title: source.title
    }, cues))

    let backgroundRelativePath: string | undefined
    if (imagePath) {
      backgroundRelativePath = `background${extname(imagePath).toLowerCase()}`
      await copyFile(imagePath, join(tempDir, backgroundRelativePath))
    }

    const renderStartedAt = Date.now()
    const renderSummary = await renderLyricsVideo({
      audioPath: source.audioPath,
      assRelativePath: 'transcript.ass',
      outputRelativePath: 'out.mp4',
      width: FIXED_RENDER_WIDTH,
      height: FIXED_RENDER_HEIGHT,
      fps: FIXED_RENDER_FPS,
      workingDirectory: tempDir,
      cues: captionCues,
      title: source.title,
      font: options.font,
      includeContext: false,
      ...(backgroundRelativePath ? { imageRelativePath: backgroundRelativePath } : {})
    })
    const renderMs = Date.now() - renderStartedAt

    await copyFile(renderedVideoPath, videoPath)

    const totalMs = Date.now() - startedAt
    await writeRunManifest(options.outputDirAbsolute, 'video', {
      mode: 'transcript-video',
      source: {
        audioPath: toProjectDisplayPath(source.audioPath),
        transcriptPath: toProjectDisplayPath(source.transcription.sourcePath),
        transcriptSource: source.transcription.source,
        ...(source.extractRunDir ? { extractRunDir: toProjectDisplayPath(source.extractRunDir) } : {}),
        ...(source.transcription.provider ? { provider: source.transcription.provider } : {}),
        ...(source.transcription.model ? { model: source.transcription.model } : {})
      },
      transcript: {
        cueSource,
        cueCount: cues.length,
        speakerCount: collectSpeakerInventory(cues).length,
        speakers: collectSpeakerInventory(cues)
      },
      render: {
        width: FIXED_RENDER_WIDTH,
        height: FIXED_RENDER_HEIGHT,
        fps: FIXED_RENDER_FPS,
        font: options.font,
        title: source.title,
        encoder: renderSummary.encoder,
        backgroundMode: renderSummary.backgroundMode,
        ...(imagePath ? { backgroundPath: toProjectDisplayPath(imagePath) } : {})
      },
      artifacts: {
        video: videoFileName,
        vtt: vttFileName,
        srt: srtFileName,
        run: 'run.json',
        tempDirKept: options.keepTmp
      },
      timing: {
        totalMs,
        cueBuildMs,
        captionsWriteMs,
        renderMs
      }
    })

    l.report.complete(options.outputDirRelative, {
      video: videoFileName,
      vtt: vttFileName,
      srt: srtFileName,
      run: 'run.json'
    }, {
      metrics: {
        cueCount: cues.length,
        cueSource,
        speakers: collectSpeakerInventory(cues).length,
        background: imagePath ? 'image' : 'spectrogram',
        encoder: renderSummary.encoder
      }
    })
  } finally {
    if (!options.keepTmp) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export const runExtractTranscriptVideo = async (
  inputPath: string | undefined,
  flags: Record<string, unknown>
): Promise<void> => {
  const source = await resolveTranscriptVideoSource(inputPath, flags)
  const font = typeof flags['font'] === 'string' && flags['font'].trim().length > 0 ? flags['font'] : 'DejaVu Sans'
  const keepTmp = flags['keep-tmp'] === true
  const outputDirRelative = joinOutputRoot(createUniqueDirectoryName(`transcript-video-${source.label}`))
  const outputDirAbsolute = resolve(PROJECT_ROOT, outputDirRelative)
  await ensureDirectory(OUTPUT_ROOT)
  await ensureDirectory(outputDirAbsolute)

  await processTranscriptVideoRun(source, {
    outputDirAbsolute,
    outputDirRelative,
    font,
    keepTmp
  })
}
