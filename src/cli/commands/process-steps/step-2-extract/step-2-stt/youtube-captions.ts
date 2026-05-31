import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as l from '~/utils/logger'
import type {
  Step2Metadata,
  SttProviderSuccess,
  SttTarget,
  TranscriptionEvidenceSegment,
  TranscriptionResult,
  YtDlpVideoInfo
} from '~/types'
import { exec } from '~/utils/cli-utils'
import { getVideoInfo } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { buildYtDlpFailureMessage, buildYtDlpSubtitleDownloadArgs } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import { getYtDlpBinary } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-binary'
import { readExistingSttRun } from './stt-batch/stt-run-state'
import { countTokens, formatTranscriptText, toTimestamp } from './stt-utils/stt-utils'
import { writeSttResultArtifact } from './stt-utils/stt-result-artifacts'
import { getSttTargetDirectoryName } from './stt-targets'
import type {
  ParsedYoutubeCue,
  YoutubeCaptionMetadataFile,
  YoutubeCaptionSelection,
  YoutubeCaptionTrack
} from '~/types'

export const YOUTUBE_CAPTIONS_SERVICE = 'youtube-captions' as const
const YOUTUBE_CAPTIONS_MODEL = 'subtitle-track' as const

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be'
])

const TIMING_LINE_PATTERN = /^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})(?:\s+.*)?$/
const INLINE_TAG_PATTERN = /<[^>]+>/g
const INLINE_TIMESTAMP_TAG_PATTERN = /<\d{2}:\d{2}(?::\d{2})?\.\d{3}>/g
const LANGUAGE_KEY_PATTERN = /^en(?:[._-].+)?$/i

const normalizeComparableText = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

const tokenizeComparableText = (value: string): string[] =>
  [...normalizeComparableText(value).matchAll(/[a-z0-9]+(?:['’-][a-z0-9]+)*/gi)].map((match) => match[0])

const createYoutubeCaptionTarget = (): SttTarget => ({
  service: YOUTUBE_CAPTIONS_SERVICE,
  model: YOUTUBE_CAPTIONS_MODEL,
  local: false
})

const sanitizeInventory = (
  inventory: YtDlpVideoInfo['subtitles'] | YtDlpVideoInfo['automatic_captions']
): YoutubeCaptionMetadataFile['subtitleInventory'] =>
  Object.fromEntries(
    Object.entries(inventory ?? {}).map(([language, tracks]) => [
      language,
      tracks.map((track) => ({
        ext: track.ext,
        ...(track.name ? { name: track.name } : {})
      }))
    ])
  )

const stripCueText = (value: string): string =>
  value
    .replace(INLINE_TIMESTAMP_TAG_PATTERN, ' ')
    .replace(INLINE_TAG_PATTERN, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()

const parseVttTimestampSeconds = (value: string): number | null => {
  const parts = value.split(':')
  if (parts.length !== 2 && parts.length !== 3) {
    return null
  }

  const [hoursText, minutesText, secondsText] = parts.length === 3
    ? [parts[0] ?? '0', parts[1] ?? '0', parts[2] ?? '0']
    : ['0', parts[0] ?? '0', parts[1] ?? '0']
  const hours = Number.parseInt(hoursText, 10)
  const minutes = Number.parseInt(minutesText, 10)
  const seconds = Number.parseFloat(secondsText)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null
  }

  return (hours * 3600) + (minutes * 60) + seconds
}

const parseYoutubeVttCues = (input: string): ParsedYoutubeCue[] => {
  const blocks = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)

  const cues: ParsedYoutubeCue[] = []
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      continue
    }

    const header = lines[0] as string
    if (
      header === 'WEBVTT'
      || header.startsWith('NOTE')
      || header.startsWith('STYLE')
      || header.startsWith('REGION')
    ) {
      continue
    }

    const timingIndex = lines.findIndex((line) => TIMING_LINE_PATTERN.test(line))
    if (timingIndex < 0) {
      continue
    }

    const match = lines[timingIndex]?.match(TIMING_LINE_PATTERN)
    if (!match) {
      continue
    }

    const startSeconds = parseVttTimestampSeconds(match[1] ?? '')
    const endSeconds = parseVttTimestampSeconds(match[2] ?? '')
    if (startSeconds === null || endSeconds === null) {
      continue
    }

    const text = lines
      .slice(timingIndex + 1)
      .map(stripCueText)
      .filter((line) => line.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length === 0) {
      continue
    }

    cues.push({
      startSeconds,
      endSeconds: Math.max(startSeconds, endSeconds),
      text
    })
  }

  return cues
}

const removeRepeatedPrefix = (previousText: string, nextText: string): string => {
  const previousTokens = tokenizeComparableText(previousText)
  const nextTokens = tokenizeComparableText(nextText)
  const maxOverlap = Math.min(previousTokens.length, nextTokens.length)

  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const previousSlice = previousTokens.slice(previousTokens.length - overlap).join(' ')
    const nextSlice = nextTokens.slice(0, overlap).join(' ')
    if (previousSlice !== nextSlice) {
      continue
    }

    let wordsRemoved = 0
    let lastIndex = 0
    for (const match of nextText.matchAll(/[a-z0-9]+(?:['’-][a-z0-9]+)*/gi)) {
      wordsRemoved += 1
      lastIndex = match.index + match[0].length
      if (wordsRemoved >= overlap) {
        break
      }
    }

    return nextText.slice(lastIndex).replace(/^[\s,.;:!?-]+/, '').trim()
  }

  return nextText.trim()
}

const collapseAutoCaptionCues = (cues: ParsedYoutubeCue[]): ParsedYoutubeCue[] => {
  const collapsed: ParsedYoutubeCue[] = []

  for (const cue of cues) {
    const previous = collapsed[collapsed.length - 1]
    if (!previous) {
      collapsed.push({ ...cue })
      continue
    }

    const dedupedText = removeRepeatedPrefix(previous.text, cue.text)
    if (dedupedText.length === 0) {
      previous.endSeconds = Math.max(previous.endSeconds, cue.endSeconds)
      continue
    }

    collapsed.push({
      ...cue,
      text: dedupedText
    })
  }

  return collapsed
}

const finalizeCueBoundaries = (cues: ParsedYoutubeCue[]): ParsedYoutubeCue[] =>
  cues.map((cue, index) => {
    const nextCue = cues[index + 1]
    const boundedEnd = nextCue && nextCue.startSeconds < cue.endSeconds
      ? nextCue.startSeconds
      : cue.endSeconds

    return {
      ...cue,
      endSeconds: Math.max(cue.startSeconds, boundedEnd)
    }
  })

const toTranscriptionResult = (
  cues: ParsedYoutubeCue[],
  selection: YoutubeCaptionSelection
): TranscriptionResult | null => {
  const cleanedCues = finalizeCueBoundaries(cues).filter((cue) => cue.text.length > 0)
  if (cleanedCues.length === 0) {
    return null
  }

  const evidenceSegments: TranscriptionEvidenceSegment[] = cleanedCues.map((cue) => ({
    startSeconds: cue.startSeconds,
    endSeconds: cue.endSeconds,
    text: cue.text
  }))

  return {
    text: cleanedCues.map((cue) => cue.text).join(' ').trim(),
    segments: cleanedCues.map((cue) => ({
      start: toTimestamp(cue.startSeconds),
      end: toTimestamp(cue.endSeconds),
      text: cue.text
    })),
    evidence: {
      segments: evidenceSegments,
      capabilities: {
        hasNativeWordTiming: false,
        hasConfidence: false,
        hasSpeakerLabels: false
      },
      timingQuality: 'segment_interpolated',
      rawResponse: {
        captionKind: selection.kind,
        captionLanguage: selection.language,
        captionFormat: 'vtt'
      }
    }
  }
}

const buildYoutubeCaptionTranscription = (
  vttText: string,
  selection: YoutubeCaptionSelection
): TranscriptionResult | null => {
  const parsedCues = parseYoutubeVttCues(vttText)
  const normalizedCues = selection.kind === 'auto'
    ? collapseAutoCaptionCues(parsedCues)
    : parsedCues
  return toTranscriptionResult(normalizedCues, selection)
}

const resolveYoutubeWatchUrl = (url: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(hostname)) {
    return null
  }

  if (hostname === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0]
    return id ? `https://www.youtube.com/watch?v=${id}` : null
  }

  if (parsed.pathname === '/watch') {
    const id = parsed.searchParams.get('v')?.trim()
    return id ? `https://www.youtube.com/watch?v=${id}` : null
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean)
  if ((pathParts[0] === 'shorts' || pathParts[0] === 'live') && pathParts[1]) {
    return `https://www.youtube.com/watch?v=${pathParts[1]}`
  }

  return null
}

const selectYoutubeCaptionTrack = (
  videoInfo: Pick<YtDlpVideoInfo, 'subtitles' | 'automatic_captions'>
): YoutubeCaptionSelection | null => {
  const pickEnglishLanguage = (
    inventory: YtDlpVideoInfo['subtitles']
  ): { language: string, track: YoutubeCaptionTrack } | null => {
    if (!inventory) {
      return null
    }

    const englishLanguages = Object.keys(inventory)
      .filter((language) => LANGUAGE_KEY_PATTERN.test(language))
      .sort((left, right) => {
        if (left === 'en' && right !== 'en') {
          return -1
        }
        if (right === 'en' && left !== 'en') {
          return 1
        }
        return left.localeCompare(right)
      })

    for (const language of englishLanguages) {
      const tracks = inventory[language] ?? []
      const selectedTrack = tracks.find((track) => track.ext === 'vtt') ?? tracks[0]
      if (selectedTrack) {
        return { language, track: selectedTrack }
      }
    }

    return null
  }

  const manual = pickEnglishLanguage(videoInfo.subtitles)
  if (manual) {
    return {
      kind: 'manual',
      language: manual.language,
      track: manual.track
    }
  }

  const automatic = pickEnglishLanguage(videoInfo.automatic_captions)
  if (automatic) {
    return {
      kind: 'auto',
      language: automatic.language,
      track: automatic.track
    }
  }

  return null
}

const scoreSubtitleFile = (fileName: string, selectedLanguage: string): number => {
  const lowerFile = fileName.toLowerCase()
  const lowerLanguage = selectedLanguage.toLowerCase()
  const underscoredLanguage = lowerLanguage.replace(/-/g, '_')

  if (lowerFile.endsWith(`.${lowerLanguage}.vtt`) || lowerFile.endsWith(`.${underscoredLanguage}.vtt`)) {
    return 3
  }
  if (lowerFile.includes('.en.') || lowerFile.endsWith('.en.vtt')) {
    return 2
  }
  return 1
}

const findDownloadedSubtitleFile = async (
  directory: string,
  selectedLanguage: string
): Promise<string | null> => {
  const entries = await readdir(directory)
  const candidates = entries.filter((entry) => entry.toLowerCase().endsWith('.vtt'))
  if (candidates.length === 0) {
    return null
  }

  return join(
    directory,
    [...candidates].sort((left, right) =>
      scoreSubtitleFile(right, selectedLanguage) - scoreSubtitleFile(left, selectedLanguage)
      || left.localeCompare(right)
    )[0] as string
  )
}

const buildCaptionMetadataFile = (
  selection: YoutubeCaptionSelection,
  videoInfo: Pick<YtDlpVideoInfo, 'subtitles' | 'automatic_captions'>
): YoutubeCaptionMetadataFile => ({
  captionKind: selection.kind,
  captionLanguage: selection.language,
  sourceUrl: selection.track.url,
  trackName: selection.track.name ?? null,
  subtitleInventory: sanitizeInventory(videoInfo.subtitles),
  automaticCaptionInventory: sanitizeInventory(videoInfo.automatic_captions)
})

const syncRootArtifact = async (
  providerDir: string,
  outputDir: string,
  fileName: string
): Promise<void> => {
  const fromPath = join(providerDir, fileName)
  const toPath = join(outputDir, fileName)
  await copyFile(fromPath, toPath).catch(() => undefined)
}

const syncRootArtifacts = async (
  providerDir: string,
  outputDir: string
): Promise<void> => {
  await Promise.all([
    syncRootArtifact(providerDir, outputDir, 'transcription.txt'),
    syncRootArtifact(providerDir, outputDir, 'youtube-captions.vtt'),
    syncRootArtifact(providerDir, outputDir, 'youtube-captions.json'),
    syncRootArtifact(providerDir, outputDir, 'result.json')
  ])
}

export const readStoredYoutubeCaptionSuccess = async (
  outputDir: string
): Promise<SttProviderSuccess | null> => {
  const existingRun = await readExistingSttRun(outputDir, [createYoutubeCaptionTarget()])
  const success = existingRun.successes[0]
  if (!success) {
    return null
  }

  const providerDir = join(outputDir, success.relativeDir ?? '')
  await syncRootArtifacts(providerDir, outputDir)
  return success
}

export const resolveYoutubeCaptionEstimateTargets = async (
  sourceUrl: string
): Promise<Array<{ service: Step2Metadata['transcriptionService'], model: string }> | null> => {
  const watchUrl = resolveYoutubeWatchUrl(sourceUrl)
  if (!watchUrl) {
    return null
  }

  const videoInfo = await getVideoInfo(watchUrl)
  if (!videoInfo || !selectYoutubeCaptionTrack(videoInfo)) {
    return null
  }

  return [{
    service: YOUTUBE_CAPTIONS_SERVICE,
    model: YOUTUBE_CAPTIONS_MODEL
  }]
}

export const tryResolveYoutubeCaptionTranscription = async (
  sourceUrl: string,
  outputDir: string,
  videoInfo: Pick<YtDlpVideoInfo, 'subtitles' | 'automatic_captions'> | undefined
): Promise<SttProviderSuccess | null> => {
  const watchUrl = resolveYoutubeWatchUrl(sourceUrl)
  if (!watchUrl || !videoInfo) {
    return null
  }

  const selection = selectYoutubeCaptionTrack(videoInfo)
  if (!selection) {
    return null
  }

  const target = createYoutubeCaptionTarget()
  const providerDir = join(outputDir, 'providers', getSttTargetDirectoryName(target))
  await mkdir(providerDir, { recursive: true })

  const startedAt = Date.now()
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-youtube-captions-'))

  try {
    const args = await buildYtDlpSubtitleDownloadArgs(watchUrl, tempDir, selection.kind)
    const result = await exec(getYtDlpBinary(), args)
    if (result.exitCode !== 0) {
      l.warn(buildYtDlpFailureMessage('subtitles', result.stderr || result.stdout || 'unknown yt-dlp error'))
      return null
    }

    const downloadedVttPath = await findDownloadedSubtitleFile(tempDir, selection.language)
    if (!downloadedVttPath) {
      l.warn('YouTube captions were selected but yt-dlp produced no VTT file; falling back to the normal STT flow')
      return null
    }

    const vttText = await Bun.file(downloadedVttPath).text()
    if (vttText.trim().length === 0) {
      l.warn('YouTube captions were downloaded but the VTT file was empty; falling back to the normal STT flow')
      return null
    }

    const transcription = buildYoutubeCaptionTranscription(vttText, selection)
    if (!transcription || transcription.text.trim().length === 0) {
      l.warn('YouTube captions were downloaded but could not be parsed into transcript cues; falling back to the normal STT flow')
      return null
    }

    const metadataFile = buildCaptionMetadataFile(selection, videoInfo)
    const step2Metadata: Step2Metadata = {
      transcriptionService: YOUTUBE_CAPTIONS_SERVICE,
      transcriptionModel: YOUTUBE_CAPTIONS_MODEL,
      processingTime: Date.now() - startedAt,
      tokenCount: countTokens(transcription.text),
      captionKind: selection.kind,
      captionLanguage: selection.language,
      captionFormat: 'vtt'
    }

    const providerTranscriptPath = join(providerDir, 'transcription.txt')
    const providerVttPath = join(providerDir, 'youtube-captions.vtt')
    const providerMetadataPath = join(providerDir, 'youtube-captions.json')
    await Bun.write(providerTranscriptPath, formatTranscriptText(transcription.segments))
    await copyFile(downloadedVttPath, providerVttPath)
    await Bun.write(providerMetadataPath, `${JSON.stringify(metadataFile, null, 2)}\n`)

    await writeSttResultArtifact(providerDir, step2Metadata, transcription)
    await syncRootArtifacts(providerDir, outputDir)

    return {
      target,
      metadata: step2Metadata,
      result: transcription,
      relativeDir: `providers/${getSttTargetDirectoryName(target)}`
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
