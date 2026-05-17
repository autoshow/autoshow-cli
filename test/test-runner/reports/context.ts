import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import type { MetricContext, ServiceModelPair, TestContext } from './types'

const COMMAND_KIND_NAMES = new Set(['setup', 'download', 'transcribe', 'extract', 'write', 'tts', 'image', 'video', 'music'])

type ArgServiceFlag = { service: string, kind: string }

const ARG_SERVICE_FLAGS: Record<string, ArgServiceFlag> = {
  '--openai': { service: 'openai', kind: 'write' },
  '--anthropic': { service: 'anthropic', kind: 'write' },
  '--gemini': { service: 'gemini', kind: 'write' },
  '--groq': { service: 'groq', kind: 'write' },
  '--minimax': { service: 'minimax', kind: 'write' },
  '--glm': { service: 'glm', kind: 'write' },
  '--kimi': { service: 'kimi', kind: 'write' },
  '--llama': { service: 'llama.cpp', kind: 'write' },
  '--whisper-stt': { service: 'whisper', kind: 'transcribe' },
  '--reverb-stt': { service: 'reverb', kind: 'transcribe' },
  '--tesseract-ocr': { service: 'tesseract', kind: 'extract' },
  '--gcloud-stt': { service: 'gcloud', kind: 'transcribe' },
  '--aws-stt': { service: 'aws', kind: 'transcribe' },
  '--deepinfra-stt': { service: 'deepinfra', kind: 'transcribe' },
  '--deapi-stt': { service: 'deapi', kind: 'transcribe' },
  '--elevenlabs-stt': { service: 'elevenlabs', kind: 'transcribe' },
  '--deepgram-stt': { service: 'deepgram', kind: 'transcribe' },
  '--soniox-stt': { service: 'soniox', kind: 'transcribe' },
  '--speechmatics-stt': { service: 'speechmatics', kind: 'transcribe' },
  '--rev-stt': { service: 'rev', kind: 'transcribe' },
  '--groq-stt': { service: 'groq', kind: 'transcribe' },
  '--grok-stt': { service: 'grok', kind: 'transcribe' },
  '--assemblyai-stt': { service: 'assemblyai', kind: 'transcribe' },
  '--gladia-stt': { service: 'gladia', kind: 'transcribe' },
  '--happyscribe-stt': { service: 'happyscribe', kind: 'transcribe' },
  '--mistral-stt': { service: 'mistral', kind: 'transcribe' },
  '--supadata-stt': { service: 'supadata', kind: 'transcribe' },
  '--scrapecreators-stt': { service: 'scrapecreators', kind: 'transcribe' },
  '--openai-stt': { service: 'openai-stt', kind: 'transcribe' },
  '--together-stt': { service: 'together', kind: 'transcribe' },
  '--gemini-stt': { service: 'gemini-stt', kind: 'transcribe' },
  '--glm-stt': { service: 'glm-stt', kind: 'transcribe' },
  '--mistral-ocr': { service: 'mistral', kind: 'extract' },
  '--glm-ocr': { service: 'glm', kind: 'extract' },
  '--kimi-ocr': { service: 'kimi', kind: 'extract' },
  '--openai-ocr': { service: 'openai', kind: 'extract' },
  '--anthropic-ocr': { service: 'anthropic', kind: 'extract' },
  '--gemini-ocr': { service: 'gemini', kind: 'extract' },
  '--deepinfra-ocr': { service: 'deepinfra', kind: 'extract' },
  '--elevenlabs-tts': { service: 'elevenlabs', kind: 'tts' },
  '--minimax-tts': { service: 'minimax', kind: 'tts' },
  '--groq-tts': { service: 'groq', kind: 'tts' },
  '--grok-tts': { service: 'grok', kind: 'tts' },
  '--mistral-tts': { service: 'mistral', kind: 'tts' },
  '--openai-tts': { service: 'openai', kind: 'tts' },
  '--gemini-tts': { service: 'gemini', kind: 'tts' },
  '--deepgram-tts': { service: 'deepgram', kind: 'tts' },
  '--hume-tts': { service: 'hume', kind: 'tts' },
  '--cartesia-tts': { service: 'cartesia', kind: 'tts' },
  '--kitten-tts': { service: 'kitten', kind: 'tts' },
  '--openai-image': { service: 'openai', kind: 'image' },
  '--gemini-image': { service: 'gemini', kind: 'image' },
  '--minimax-image': { service: 'minimax', kind: 'image' },
  '--glm-image': { service: 'glm', kind: 'image' },
  '--grok-image': { service: 'grok', kind: 'image' },
  '--runway-image': { service: 'runway', kind: 'image' },
  '--bfl-image': { service: 'bfl', kind: 'image' },
  '--deapi-image': { service: 'deapi', kind: 'image' },
  '--gemini-video': { service: 'gemini', kind: 'video' },
  '--minimax-video': { service: 'minimax', kind: 'video' },
  '--glm-video': { service: 'glm', kind: 'video' },
  '--grok-video': { service: 'grok', kind: 'video' },
  '--runway-video': { service: 'runway', kind: 'video' },
  '--deapi-video': { service: 'deapi', kind: 'video' },
  '--elevenlabs-music': { service: 'elevenlabs', kind: 'music' },
  '--minimax-music': { service: 'minimax', kind: 'music' },
  '--deapi-music': { service: 'deapi', kind: 'music' },
  '--gemini-music': { service: 'gemini', kind: 'music' },
  '--aws-textract': { service: 'aws', kind: 'extract' },
  '--gcloud-docai': { service: 'gcloud', kind: 'extract' },
  '--ocrmypdf': { service: 'ocrmypdf', kind: 'extract' },
}

const COMMAND_PUBLIC_SERVICE_FLAGS: Record<string, Record<string, ArgServiceFlag>> = {
  tts: {
    '--kitten': { service: 'kitten', kind: 'tts' },
    '--elevenlabs': { service: 'elevenlabs', kind: 'tts' },
    '--minimax': { service: 'minimax', kind: 'tts' },
    '--groq': { service: 'groq', kind: 'tts' },
    '--grok': { service: 'grok', kind: 'tts' },
    '--mistral': { service: 'mistral', kind: 'tts' },
    '--openai': { service: 'openai', kind: 'tts' },
    '--gemini': { service: 'gemini', kind: 'tts' },
    '--deepgram': { service: 'deepgram', kind: 'tts' },
    '--speechify': { service: 'speechify', kind: 'tts' },
    '--hume': { service: 'hume', kind: 'tts' },
    '--cartesia': { service: 'cartesia', kind: 'tts' },
    '--gcloud': { service: 'gcloud', kind: 'tts' },
    '--deapi': { service: 'deapi', kind: 'tts' },
  },
  image: {
    '--gemini': { service: 'gemini', kind: 'image' },
    '--openai': { service: 'openai', kind: 'image' },
    '--minimax': { service: 'minimax', kind: 'image' },
    '--glm': { service: 'glm', kind: 'image' },
    '--grok': { service: 'grok', kind: 'image' },
    '--runway': { service: 'runway', kind: 'image' },
    '--bfl': { service: 'bfl', kind: 'image' },
    '--deapi': { service: 'deapi', kind: 'image' },
  },
  video: {
    '--gemini': { service: 'gemini', kind: 'video' },
    '--minimax': { service: 'minimax', kind: 'video' },
    '--glm': { service: 'glm', kind: 'video' },
    '--grok': { service: 'grok', kind: 'video' },
    '--runway': { service: 'runway', kind: 'video' },
    '--deapi': { service: 'deapi', kind: 'video' },
  },
  music: {
    '--elevenlabs': { service: 'elevenlabs', kind: 'music' },
    '--minimax': { service: 'minimax', kind: 'music' },
    '--deapi': { service: 'deapi', kind: 'music' },
    '--gemini': { service: 'gemini', kind: 'music' },
  },
}

const EXTRACT_PUBLIC_STT_SERVICE_FLAGS: Record<string, ArgServiceFlag> = {
  '--whisper': { service: 'whisper', kind: 'transcribe' },
  '--reverb': { service: 'reverb', kind: 'transcribe' },
  '--gcloud': { service: 'gcloud', kind: 'transcribe' },
  '--aws': { service: 'aws', kind: 'transcribe' },
  '--deepinfra': { service: 'deepinfra', kind: 'transcribe' },
  '--deapi': { service: 'deapi', kind: 'transcribe' },
  '--elevenlabs': { service: 'elevenlabs', kind: 'transcribe' },
  '--deepgram': { service: 'deepgram', kind: 'transcribe' },
  '--soniox': { service: 'soniox', kind: 'transcribe' },
  '--speechmatics': { service: 'speechmatics', kind: 'transcribe' },
  '--rev': { service: 'rev', kind: 'transcribe' },
  '--groq': { service: 'groq', kind: 'transcribe' },
  '--grok': { service: 'grok', kind: 'transcribe' },
  '--mistral': { service: 'mistral', kind: 'transcribe' },
  '--assemblyai': { service: 'assemblyai', kind: 'transcribe' },
  '--gladia': { service: 'gladia', kind: 'transcribe' },
  '--happyscribe': { service: 'happyscribe', kind: 'transcribe' },
  '--supadata': { service: 'supadata', kind: 'transcribe' },
  '--scrapecreators': { service: 'scrapecreators', kind: 'transcribe' },
  '--openai': { service: 'openai-stt', kind: 'transcribe' },
  '--gemini': { service: 'gemini-stt', kind: 'transcribe' },
  '--glm': { service: 'glm-stt', kind: 'transcribe' },
  '--together': { service: 'together', kind: 'transcribe' },
}

const EXTRACT_PUBLIC_OCR_SERVICE_FLAGS: Record<string, ArgServiceFlag> = {
  '--tesseract': { service: 'tesseract', kind: 'extract' },
  '--ocrmypdf': { service: 'ocrmypdf', kind: 'extract' },
  '--paddle': { service: 'paddle', kind: 'extract' },
  '--mistral': { service: 'mistral', kind: 'extract' },
  '--glm': { service: 'glm', kind: 'extract' },
  '--kimi': { service: 'kimi', kind: 'extract' },
  '--openai': { service: 'openai', kind: 'extract' },
  '--anthropic': { service: 'anthropic', kind: 'extract' },
  '--gemini': { service: 'gemini', kind: 'extract' },
  '--deepinfra': { service: 'deepinfra', kind: 'extract' },
  '--aws': { service: 'aws', kind: 'extract' },
  '--gcloud': { service: 'gcloud', kind: 'extract' },
}

const MEDIA_INPUT_PATTERN = /\.(?:mp3|m4a|aac|wav|flac|ogg|opus|webm|mp4|mov|mkv|avi|m4v)(?:[?#]|$)/i
const DOCUMENT_INPUT_PATTERN = /\.(?:pdf|epub|mobi|azw3|fb2|lit|docx|pptx|xlsx|odt|ods|odp|rtf|csv|cbz|png|jpe?g|tiff?|webp|bmp|gif)(?:[?#]|$)/i

const KNOWN_SERVICE_HINTS: Array<{ pattern: RegExp, service: string }> = [
  { pattern: /\bopenai\b/i, service: 'openai' },
  { pattern: /\banthropic\b/i, service: 'anthropic' },
  { pattern: /\bgemini\b/i, service: 'gemini' },
  { pattern: /\bgroq\b/i, service: 'groq' },
  { pattern: /\bgrok\b/i, service: 'grok' },
  { pattern: /\bminimax\b/i, service: 'minimax' },
  { pattern: /\belevenlabs\b/i, service: 'elevenlabs' },
  { pattern: /\bgcloud\b/i, service: 'gcloud' },
  { pattern: /\bgoogle cloud\b/i, service: 'gcloud' },
  { pattern: /\baws\b/i, service: 'aws' },
  { pattern: /\bdeepgram\b/i, service: 'deepgram' },
  { pattern: /\bhume\b/i, service: 'hume' },
  { pattern: /\bcartesia\b/i, service: 'cartesia' },
  { pattern: /\bdeepinfra\b/i, service: 'deepinfra' },
  { pattern: /\bdeapi\b/i, service: 'deapi' },
  { pattern: /\bsoniox\b/i, service: 'soniox' },
  { pattern: /\bspeechmatics\b/i, service: 'speechmatics' },
  { pattern: /\brev\b/i, service: 'rev' },
  { pattern: /\bassemblyai\b/i, service: 'assemblyai' },
  { pattern: /\bgladia\b/i, service: 'gladia' },
  { pattern: /\bhappyscribe\b/i, service: 'happyscribe' },
  { pattern: /\bhappy scribe\b/i, service: 'happyscribe' },
  { pattern: /\bmistral\b/i, service: 'mistral' },
  { pattern: /\bsupadata\b/i, service: 'supadata' },
  { pattern: /\bscrapecreators\b/i, service: 'scrapecreators' },
  { pattern: /\bscrape creators\b/i, service: 'scrapecreators' },
  { pattern: /\bfirecrawl\b/i, service: 'firecrawl' },
  { pattern: /\bglm(?:-reader)?\b/i, service: 'glm' },
  { pattern: /\bkimi\b/i, service: 'kimi' },
  { pattern: /\brunway\b/i, service: 'runway' },
  { pattern: /\bwhisper\b/i, service: 'whisper' },
  { pattern: /\bllama\b/i, service: 'llama.cpp' },
  { pattern: /\bkitten\b/i, service: 'kitten' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const cleanValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

export const normalizeValue = (value: string | null | undefined): string | null => {
  const cleaned = cleanValue(value)
  return cleaned ? cleaned.toLowerCase() : null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

const dedupePairs = (pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const seen = new Set<string>()
  const out: ServiceModelPair[] = []

  for (const pair of pairs) {
    const key = `${pair.kind ?? ''}::${normalizeValue(pair.service) ?? ''}::${normalizeValue(pair.model) ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(pair)
  }

  return out
}

const pushPair = (
  pairs: ServiceModelPair[],
  kind: string | null,
  service: string | null | undefined,
  model: string | null | undefined
): void => {
  const cleanedService = cleanValue(service)
  if (!cleanedService) return

  pairs.push({
    kind,
    service: cleanedService,
    model: cleanValue(model),
  })
}

export const isE2ETestFile = (file: string): boolean => file.startsWith('test/test-cases/e2e/')

export const isControlE2ETest = (name: string): boolean => {
  return /^rejects\b/i.test(name)
    || /^requires\b/i.test(name)
    || /^all output files\b/i.test(name)
    || /^selects exactly one model\b/i.test(name)
}

const parseMetricCommandKind = (metric: ParsedCommandMetric): string | null => {
  const subcommand = metric.args.find(arg => COMMAND_KIND_NAMES.has(arg))
  if (subcommand && COMMAND_KIND_NAMES.has(subcommand)) {
    return subcommand
  }

  if (metric.args.length > 1) {
    return 'write'
  }

  return null
}

const getMetricCommandInput = (metric: ParsedCommandMetric): string | null => {
  const commandIndex = metric.args.findIndex(arg => COMMAND_KIND_NAMES.has(arg))
  if (commandIndex < 0) return null

  for (let index = commandIndex + 1; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg || arg.startsWith('--')) {
      continue
    }

    const previous = metric.args[index - 1]
    if (previous?.startsWith('--')) {
      continue
    }

    return arg
  }

  return null
}

const inferExtractRouteKind = (metric: ParsedCommandMetric): 'transcribe' | 'extract' | null => {
  const input = getMetricCommandInput(metric)
  if (!input) return null

  if (MEDIA_INPUT_PATTERN.test(input) || /\b(?:youtube\.com|youtu\.be|twitch\.tv)\b/i.test(input)) {
    return 'transcribe'
  }

  if (DOCUMENT_INPUT_PATTERN.test(input)) {
    return 'extract'
  }

  return null
}

const resolveExtractPublicServiceFlag = (
  arg: string,
  metric: ParsedCommandMetric
): ArgServiceFlag | null => {
  const routeKind = inferExtractRouteKind(metric)
  if (routeKind === 'transcribe') {
    return EXTRACT_PUBLIC_STT_SERVICE_FLAGS[arg] ?? null
  }
  if (routeKind === 'extract') {
    return EXTRACT_PUBLIC_OCR_SERVICE_FLAGS[arg] ?? null
  }

  return EXTRACT_PUBLIC_STT_SERVICE_FLAGS[arg] ?? EXTRACT_PUBLIC_OCR_SERVICE_FLAGS[arg] ?? null
}

const resolveArgServiceFlag = (
  arg: string,
  commandKind: string | null,
  metric: ParsedCommandMetric
): ArgServiceFlag | null => {
  if (commandKind === 'extract') {
    const extractFlag = resolveExtractPublicServiceFlag(arg, metric)
    if (extractFlag) return extractFlag
  }

  const commandFlag = commandKind ? COMMAND_PUBLIC_SERVICE_FLAGS[commandKind]?.[arg] : null
  return commandFlag ?? ARG_SERVICE_FLAGS[arg] ?? null
}

const buildPairsFromMetricArgs = (metric: ParsedCommandMetric): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []
  const commandKind = parseMetricCommandKind(metric)

  for (let index = 0; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg) continue

    if (arg === '--url-backend') {
      const next = metric.args[index + 1]
      if (next === 'firecrawl') {
        pushPair(pairs, 'extract', 'firecrawl', 'firecrawl')
      } else if (next === 'glm-reader') {
        pushPair(pairs, 'extract', 'glm', 'glm-reader')
      } else if (next === 'spider') {
        pushPair(pairs, 'extract', 'spider', 'spider')
      } else if (next === 'zyte') {
        pushPair(pairs, 'extract', 'zyte', 'zyte')
      }
      continue
    }

    const flag = resolveArgServiceFlag(arg, commandKind, metric)
    if (!flag) continue

    const next = metric.args[index + 1]
    const model = next && !next.startsWith('--') ? next : null
    pushPair(pairs, flag.kind, flag.service, model)
  }

  return dedupePairs(pairs)
}

const extractPairsFromMetadata = (metadata: Record<string, unknown>): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []

  const step2 = typeof metadata['step2'] === 'object' && metadata['step2'] !== null
    ? metadata['step2'] as Record<string, unknown>
    : null
  const step3Entries = toRecordArray(metadata['step3'])
  const step4Entries = toRecordArray(metadata['step4'])
  const musicEntries = toRecordArray(metadata['music'])
  const ttsEntries = toRecordArray(metadata['tts'])
  const imageEntries = [
    ...toRecordArray(metadata['step5']),
    ...toRecordArray(metadata['image'])
  ]
  const videoEntries = toRecordArray(metadata['video'])

  pushPair(
    pairs,
    'transcribe',
    typeof step2?.['transcriptionService'] === 'string' ? step2['transcriptionService'] : null,
    typeof step2?.['transcriptionModel'] === 'string' ? step2['transcriptionModel'] : null
  )
  pushPair(
    pairs,
    'extract',
    typeof step2?.['ocrService'] === 'string'
      ? step2['ocrService']
      : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('mistral-ocr')
        ? 'mistral'
        : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-ocr')
          ? 'glm'
          : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('kimi-ocr')
            ? 'kimi'
            : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('openai-ocr')
              ? 'openai'
              : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('anthropic-ocr')
                ? 'anthropic'
                : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('gemini-ocr')
                  ? 'gemini'
                  : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-reader')
                    ? 'glm'
                    : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('firecrawl')
                      ? 'firecrawl'
                      : null,
    typeof step2?.['ocrModel'] === 'string'
      ? step2['ocrModel']
      : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-reader')
        ? 'glm-reader'
        : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('firecrawl')
          ? 'firecrawl'
          : null
  )

  for (const step3 of step3Entries) {
    pushPair(
      pairs,
      'write',
      typeof step3['llmService'] === 'string' ? step3['llmService'] : null,
      typeof step3['llmModel'] === 'string' ? step3['llmModel'] : null
    )
  }

  for (const step4 of step4Entries) {
    pushPair(
      pairs,
      'tts',
      typeof step4['ttsService'] === 'string' ? step4['ttsService'] : null,
      typeof step4['ttsModel'] === 'string' ? step4['ttsModel'] : null
    )
  }

  for (const music of musicEntries) {
    pushPair(
      pairs,
      'music',
      typeof music['musicService'] === 'string' ? music['musicService'] : null,
      typeof music['musicModel'] === 'string' ? music['musicModel'] : null
    )
  }

  for (const tts of ttsEntries) {
    pushPair(
      pairs,
      'tts',
      typeof tts['ttsService'] === 'string' ? tts['ttsService'] : null,
      typeof tts['ttsModel'] === 'string' ? tts['ttsModel'] : null
    )
  }

  for (const image of imageEntries) {
    pushPair(
      pairs,
      'image',
      typeof image['imageService'] === 'string' ? image['imageService'] : null,
      typeof image['imageModel'] === 'string' ? image['imageModel'] : null
    )
  }

  for (const video of videoEntries) {
    pushPair(
      pairs,
      'video',
      typeof video['videoService'] === 'string' ? video['videoService'] : null,
      typeof video['videoModel'] === 'string' ? video['videoModel'] : null
    )
  }

  return dedupePairs(pairs)
}

const getMetricMetadata = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  cache: Map<string, Record<string, unknown> | null>
): Promise<Record<string, unknown> | null> => {
  if (!metric.outputDir) return null

  const key = basename(metric.outputDir)
  if (cache.has(key)) {
    return cache.get(key) ?? null
  }

  const metadataPath = resolve(artifacts.metadataDirPath, `${key}.json`)

  try {
    const parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>
      cache.set(key, record)
      return record
    }
  } catch {
  }

  cache.set(key, null)
  return null
}

export const buildMetricContext = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  metadataCache: Map<string, Record<string, unknown> | null>
): Promise<MetricContext> => {
  const metadata = await getMetricMetadata(metric, artifacts, metadataCache)
  const pairs = dedupePairs([
    ...extractPairsFromMetadata(metadata ?? {}),
    ...buildPairsFromMetricArgs(metric),
  ])

  return {
    metric,
    kind: parseMetricCommandKind(metric),
    isPrice: metric.args.includes('--price'),
    pairs,
  }
}

export const inferTestKind = (testCase: ParsedJunitCase): string | null => {
  if (testCase.file.includes('/step-7-music-gen-e2e/')) return 'music'
  if (testCase.file.includes('/step-6-video-gen-e2e/')) return 'video'
  if (testCase.file.includes('/step-5-image-gen-e2e/')) return 'image'
  if (testCase.file.includes('/step-4-tts-e2e/')) return 'tts'
  if (testCase.file.includes('/step-3-write-e2e/')) return 'write'
  if (testCase.file.includes('/step-2-stt-e2e/')) return 'transcribe'
  if (testCase.file.includes('/step-2-ocr-e2e/')) return 'extract'
  if (/\btranscribe\b/i.test(testCase.name)) return 'transcribe'
  if (/\bextract\b/i.test(testCase.name)) return 'extract'
  if (/\btts\b/i.test(testCase.name) || /speech\.wav/i.test(testCase.name)) return 'tts'
  if (/\bimage\b/i.test(testCase.name) || /generated-image/i.test(testCase.name)) return 'image'
  if (/\bvideo\b/i.test(testCase.name) || /\bveo\b/i.test(testCase.name)) return 'video'
  if (/\bmusic\b/i.test(testCase.name) || /generated music/i.test(testCase.name)) return 'music'
  if (/uses cheapest model/i.test(testCase.name)) return 'write'
  return null
}

const inferServiceHints = (testCase: ParsedJunitCase): Set<string> => {
  const text = `${testCase.file} ${testCase.name}`
  const services = new Set<string>()

  for (const hint of KNOWN_SERVICE_HINTS) {
    if (hint.pattern.test(text)) {
      services.add(hint.service)
    }
  }

  return services
}

const addModelHint = (models: Set<string>, value: string | null | undefined): void => {
  const normalized = normalizeValue(value)
  if (normalized) {
    models.add(normalized)
  }
}

const inferModelHints = (testCase: ParsedJunitCase): Set<string> => {
  const models = new Set<string>()
  const name = testCase.name

  addModelHint(models, name.match(/uses cheapest model (.+?)(?: at minimal cost settings)?$/i)?.[1])
  addModelHint(models, name.match(/with --mistral-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --glm-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --kimi-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --openai-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --anthropic-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --gemini-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/^([A-Za-z0-9./_-]+) (?:model generates|generates|runs in parallel|uses cheapest model)/i)?.[1])

  for (const match of name.matchAll(/--[a-z-]+\s+([A-Za-z0-9./_-]+)/gi)) {
    addModelHint(models, match[1])
  }

  return models
}

export const buildTestContext = (testCase: ParsedJunitCase): TestContext => {
  return {
    testCase,
    kind: inferTestKind(testCase),
    isPrice: /\bprice\b/i.test(testCase.name),
    serviceHints: inferServiceHints(testCase),
    modelHints: inferModelHints(testCase),
  }
}

export const selectPrimaryPairs = (testCase: ParsedJunitCase, pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const deduped = dedupePairs(pairs)
  if (deduped.length === 0) return []

  const kind = inferTestKind(testCase)
  if (!kind) return deduped

  const kindMatches = deduped.filter(pair => pair.kind === kind)
  return kindMatches.length > 0 ? kindMatches : deduped
}

export const joinUnique = (values: Array<string | null>): string | null => {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  return unique.length > 0 ? unique.join(', ') : null
}
