import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import type { MetricContext, ServiceModelPair, TestContext } from './types'

const COMMAND_KIND_NAMES = new Set(['setup', 'sample', 'download', 'stt', 'transcribe', 'ocr', 'extract', 'write', 'tts', 'image', 'video', 'music'])

const normalizeMetricCommandKind = (kind: string): string => {
  if (kind === 'stt') return 'transcribe'
  if (kind === 'ocr') return 'extract'
  return kind
}

const ARG_SERVICE_FLAGS: Record<string, { service: string, kind: string }> = {
  '--openai': { service: 'openai', kind: 'write' },
  '--anthropic': { service: 'anthropic', kind: 'write' },
  '--gemini': { service: 'gemini', kind: 'write' },
  '--groq': { service: 'groq', kind: 'write' },
  '--minimax': { service: 'minimax', kind: 'write' },
  '--llama': { service: 'llama.cpp', kind: 'write' },
  '--whisper-stt': { service: 'whisper', kind: 'transcribe' },
  '--whisper': { service: 'whisper', kind: 'transcribe' },
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
  '--assemblyai-stt': { service: 'assemblyai', kind: 'transcribe' },
  '--gladia-stt': { service: 'gladia', kind: 'transcribe' },
  '--happyscribe-stt': { service: 'happyscribe', kind: 'transcribe' },
  '--mistral-stt': { service: 'mistral', kind: 'transcribe' },
  '--supadata-stt': { service: 'supadata', kind: 'transcribe' },
  '--openai-stt': { service: 'openai-stt', kind: 'transcribe' },
  '--together-stt': { service: 'together', kind: 'transcribe' },
  '--fireworks-stt': { service: 'fireworks', kind: 'transcribe' },
  '--cloudflare-stt': { service: 'cloudflare', kind: 'transcribe' },
  '--gemini-stt': { service: 'gemini-stt', kind: 'transcribe' },
  '--glm-stt': { service: 'glm-stt', kind: 'transcribe' },
  '--mistral-ocr': { service: 'mistral', kind: 'extract' },
  '--glm-ocr': { service: 'glm', kind: 'extract' },
  '--openai-ocr': { service: 'openai', kind: 'extract' },
  '--anthropic-ocr': { service: 'anthropic', kind: 'extract' },
  '--gemini-ocr': { service: 'gemini', kind: 'extract' },
  '--elevenlabs-tts': { service: 'elevenlabs', kind: 'tts' },
  '--minimax-tts': { service: 'minimax', kind: 'tts' },
  '--groq-tts': { service: 'groq', kind: 'tts' },
  '--openai-tts': { service: 'openai', kind: 'tts' },
  '--gemini-tts': { service: 'gemini', kind: 'tts' },
  '--deepgram-tts': { service: 'deepgram', kind: 'tts' },
  '--kitten-tts': { service: 'kitten', kind: 'tts' },
  '--openai-image': { service: 'openai', kind: 'image' },
  '--gemini-image': { service: 'gemini', kind: 'image' },
  '--minimax-image': { service: 'minimax', kind: 'image' },
  '--gemini-video': { service: 'gemini', kind: 'video' },
  '--minimax-video': { service: 'minimax', kind: 'video' },
  '--elevenlabs-music': { service: 'elevenlabs', kind: 'music' },
  '--minimax-music': { service: 'minimax', kind: 'music' },
}

const KNOWN_SERVICE_HINTS: Array<{ pattern: RegExp, service: string }> = [
  { pattern: /\bopenai\b/i, service: 'openai' },
  { pattern: /\banthropic\b/i, service: 'anthropic' },
  { pattern: /\bgemini\b/i, service: 'gemini' },
  { pattern: /\bgroq\b/i, service: 'groq' },
  { pattern: /\bminimax\b/i, service: 'minimax' },
  { pattern: /\belevenlabs\b/i, service: 'elevenlabs' },
  { pattern: /\bgcloud\b/i, service: 'gcloud' },
  { pattern: /\bgoogle cloud\b/i, service: 'gcloud' },
  { pattern: /\baws\b/i, service: 'aws' },
  { pattern: /\bdeepgram\b/i, service: 'deepgram' },
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
  { pattern: /\bfirecrawl\b/i, service: 'firecrawl' },
  { pattern: /\bglm(?:-reader)?\b/i, service: 'glm' },
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
  const subcommand = metric.args[1]
  if (subcommand && COMMAND_KIND_NAMES.has(subcommand)) {
    return normalizeMetricCommandKind(subcommand)
  }

  if (metric.args.length > 1) {
    return 'write'
  }

  return null
}

const buildPairsFromMetricArgs = (metric: ParsedCommandMetric): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []

  for (let index = 0; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg) continue

    if (arg === '--url-backend') {
      const next = metric.args[index + 1]
      if (next === 'firecrawl') {
        pushPair(pairs, 'extract', 'firecrawl', 'firecrawl')
      } else if (next === 'glm-reader') {
        pushPair(pairs, 'extract', 'glm', 'glm-reader')
      }
      continue
    }

    const flag = ARG_SERVICE_FLAGS[arg]
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
