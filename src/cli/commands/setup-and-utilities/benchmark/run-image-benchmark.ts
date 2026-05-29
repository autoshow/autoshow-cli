import { stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, resolve } from 'node:path'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { createHumanTable, createKeyValueTable } from '~/utils/logger/human-table'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/client'
import type { BenchmarkFlags } from './benchmark-types'

type JsonObject = Record<string, unknown>

type ImageRunEntry = {
  imageService: string
  imageModel: string
  imageFileNames: string[]
  processingTimeMs?: number
  costCents?: number
}

type ImageRunJson = {
  kind: 'image'
  metadata: {
    input: string
    image: ImageRunEntry[]
  }
  raw: JsonObject
}

type ImageFileReference = {
  fileName: string
  path: string
  mimeType: string
}

type ImageBenchmarkProvider = {
  providerKey: string
  provider: string
  model: string
  group: 'local' | 'service'
  processingTimeMs?: number
  costCents?: number
  images: ImageFileReference[]
}

type ImageCriterionScores = {
  promptAdherence: number
  visualQuality: number
  artifactControl: number
  composition: number
  detailTextHandling: number
}

type ImageEvaluation = {
  fileName: string
  criterionScores: ImageCriterionScores
  averageScore10: number
  qualityScore: number
  summary: string
  strengths: string[]
  issues: string[]
  usage?: JsonObject
}

type ImageQualityProviderReport = {
  rank: number
  providerKey: string
  provider: string
  model: string
  group: 'local' | 'service'
  imageFiles: string[]
  imageCount: number
  processingTimeMs?: number
  costCents?: number
  criterionScores: ImageCriterionScores
  averageScore10: number
  qualityScore: number
  qualityMetric: 'image quality score'
  evidence: {
    summary: string
    strengths: string[]
    issues: string[]
  }
  images: ImageEvaluation[]
}

type ImageQualityReport = {
  schemaVersion: 1
  kind: 'image-quality-report'
  runDir: string
  runName: string
  generatedAt: string
  judge: {
    provider: 'openai'
    model: string
    endpoint: 'responses'
  }
  prompt: string
  rubric: {
    scale: '1-10'
    qualityScore: 'average criterion score x 10'
    criteria: string[]
  }
  providerCount: number
  imageCount: number
  providers: ImageQualityProviderReport[]
}

const DEFAULT_IMAGE_JUDGE_MODEL = 'gpt-5.5'
const QUALITY_METRIC_NAME = 'image quality score'

const IMAGE_QUALITY_CRITERIA = [
  'prompt adherence',
  'visual quality',
  'artifact control',
  'composition',
  'detail/text handling'
] as const

const IMAGE_JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'promptAdherence',
    'visualQuality',
    'artifactControl',
    'composition',
    'detailTextHandling',
    'summary',
    'strengths',
    'issues'
  ],
  properties: {
    promptAdherence: { type: 'integer', minimum: 1, maximum: 10 },
    visualQuality: { type: 'integer', minimum: 1, maximum: 10 },
    artifactControl: { type: 'integer', minimum: 1, maximum: 10 },
    composition: { type: 'integer', minimum: 1, maximum: 10 },
    detailTextHandling: { type: 'integer', minimum: 1, maximum: 10 },
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' }
    },
    issues: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getObject = (object: JsonObject, key: string): JsonObject | undefined => {
  const value = object[key]
  return isRecord(value) ? value : undefined
}

const getString = (object: JsonObject, key: string): string | undefined => {
  const value = object[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

const getNumber = (object: JsonObject, key: string): number | undefined => {
  const value = object[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const getArray = (object: JsonObject, key: string): unknown[] => {
  const value = object[key]
  return Array.isArray(value) ? value : []
}

const round2 = (value: number): number => Math.round(value * 100) / 100

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const providerKey = (service: string, model: string): string => `${service}/${model}`

const providerGroup = (service: string): 'local' | 'service' =>
  service === 'local' ? 'local' : 'service'

const imageMimeType = (fileName: string): string => {
  switch (extname(fileName).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      throw CLIUsageError(`Unsupported image benchmark file type for ${fileName}. Expected PNG, JPEG, or WebP.`)
  }
}

const ensureDirectory = async (path: string, label: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isDirectory()) {
      throw CLIUsageError(`${label} must be a run directory: ${path}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    throw CLIUsageError(`${label} not found: ${path}`)
  }
}

const ensureFile = async (path: string, message: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isFile()) {
      throw CLIUsageError(message)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIUsageError') {
      throw error
    }
    throw CLIUsageError(message)
  }
}

const costFromRunCostSteps = (runJson: JsonObject, service: string, model: string): number | undefined => {
  const metadata = getObject(runJson, 'metadata')
  const cost = metadata ? getObject(metadata, 'cost') : undefined
  const sources = [
    cost ? getObject(cost, 'actual') : undefined,
    cost ? getObject(cost, 'estimated') : undefined
  ]

  for (const source of sources) {
    if (!source) {
      continue
    }

    for (const step of getArray(source, 'steps').filter(isRecord)) {
      if (getString(step, 'provider') === service && getString(step, 'model') === model) {
        const value = getNumber(step, 'cost') ?? getNumber(step, 'costCents') ?? getNumber(step, 'actualCostCents')
        if (value !== undefined) {
          return value
        }
      }
    }
  }

  return undefined
}

const parseImageRunEntry = (
  rawEntry: JsonObject,
  rawRunJson: JsonObject,
  index: number
): ImageRunEntry => {
  const imageService = getString(rawEntry, 'imageService')
  const imageModel = getString(rawEntry, 'imageModel')
  if (!imageService || !imageModel) {
    throw CLIUsageError(`Image benchmark metadata.image[${index}] must include imageService and imageModel.`)
  }

  const imageFileNames = getArray(rawEntry, 'imageFileNames')
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  if (imageFileNames.length === 0) {
    throw CLIUsageError(`Image benchmark metadata.image[${index}] must include imageFileNames[].`)
  }

  const processingTimeMs = getNumber(rawEntry, 'processingTime')
  const costCents = getNumber(rawEntry, 'providerCostCents') ?? costFromRunCostSteps(rawRunJson, imageService, imageModel)

  return {
    imageService,
    imageModel,
    imageFileNames,
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {})
  }
}

const loadImageRunJson = async (runDir: string): Promise<ImageRunJson> => {
  await ensureDirectory(runDir, 'Image run directory')

  const runJsonPath = join(runDir, 'run.json')
  await ensureFile(runJsonPath, `Image run directory is missing run.json: ${runJsonPath}`)

  let rawJson: unknown
  try {
    rawJson = JSON.parse(await Bun.file(runJsonPath).text()) as unknown
  } catch (error) {
    throw CLIUsageError(`Image benchmark run.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!isRecord(rawJson)) {
    throw CLIUsageError('Image benchmark run.json must be a JSON object.')
  }

  const kind = getString(rawJson, 'kind')
  if (kind !== 'image') {
    throw CLIUsageError(`run.json kind is "${kind ?? 'unknown'}", expected "image"`)
  }

  const metadata = getObject(rawJson, 'metadata')
  if (!metadata) {
    throw CLIUsageError('Image benchmark run.json is missing metadata.')
  }

  const input = getString(metadata, 'input')
  if (!input) {
    throw CLIUsageError('Image benchmark source prompt is missing. This run.json must contain metadata.input.')
  }

  const imageEntries = getArray(metadata, 'image')
  if (imageEntries.length === 0) {
    throw CLIUsageError('Image benchmark run.json must contain metadata.image[].')
  }

  const image = imageEntries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw CLIUsageError(`Image benchmark metadata.image[${index}] must be an object.`)
    }
    return parseImageRunEntry(entry, rawJson, index)
  })

  return {
    kind: 'image',
    metadata: {
      input,
      image
    },
    raw: rawJson
  }
}

const resolveImageProviders = async (
  runDir: string,
  runJson: ImageRunJson
): Promise<ImageBenchmarkProvider[]> => {
  const providers = new Map<string, ImageBenchmarkProvider>()

  for (const entry of runJson.metadata.image) {
    const key = providerKey(entry.imageService, entry.imageModel)
    let provider = providers.get(key)
    if (!provider) {
      provider = {
        providerKey: key,
        provider: entry.imageService,
        model: entry.imageModel,
        group: providerGroup(entry.imageService),
        ...(entry.processingTimeMs !== undefined ? { processingTimeMs: entry.processingTimeMs } : {}),
        ...(entry.costCents !== undefined ? { costCents: entry.costCents } : {}),
        images: []
      }
      providers.set(key, provider)
    }

    for (const fileName of entry.imageFileNames) {
      if (isAbsolute(fileName)) {
        throw CLIUsageError(`Image benchmark imageFileNames must be relative to the run directory: ${fileName}`)
      }

      const imagePath = resolve(runDir, fileName)
      await ensureFile(imagePath, `Image benchmark image file not found: ${imagePath}`)
      provider.images.push({
        fileName,
        path: imagePath,
        mimeType: imageMimeType(fileName)
      })
    }
  }

  return [...providers.values()].sort((left, right) => left.providerKey.localeCompare(right.providerKey))
}

const stripJsonCodeFence = (rawText: string): string => {
  const trimmed = rawText.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

const parseJsonObjectFromText = (rawText: string): JsonObject => {
  const direct = stripJsonCodeFence(rawText)

  try {
    const parsed = JSON.parse(direct) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  } catch {
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(direct.slice(start, end + 1)) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  }

  throw new Error('OpenAI image judge response was not a JSON object.')
}

const requireScore = (object: JsonObject, key: keyof ImageCriterionScores): number => {
  const value = getNumber(object, key)
  if (value === undefined || value < 1 || value > 10) {
    throw new Error(`OpenAI image judge response field ${key} must be a number from 1 through 10.`)
  }
  return value
}

const stringArray = (object: JsonObject, key: string): string[] =>
  getArray(object, key)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())

const parseImageJudgeResponse = (rawText: string, fileName: string): ImageEvaluation => {
  const parsed = parseJsonObjectFromText(rawText)
  const criterionScores: ImageCriterionScores = {
    promptAdherence: requireScore(parsed, 'promptAdherence'),
    visualQuality: requireScore(parsed, 'visualQuality'),
    artifactControl: requireScore(parsed, 'artifactControl'),
    composition: requireScore(parsed, 'composition'),
    detailTextHandling: requireScore(parsed, 'detailTextHandling')
  }
  const averageScore10 = round2(average(Object.values(criterionScores)))
  const summary = getString(parsed, 'summary')
  if (!summary) {
    throw new Error('OpenAI image judge response field summary must be a non-empty string.')
  }

  return {
    fileName,
    criterionScores,
    averageScore10,
    qualityScore: round2(averageScore10 * 10),
    summary,
    strengths: stringArray(parsed, 'strengths'),
    issues: stringArray(parsed, 'issues')
  }
}

const imageDataUrl = async (image: ImageFileReference): Promise<string> => {
  const bytes = await Bun.file(image.path).arrayBuffer()
  return `data:${image.mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}

const buildImageJudgePrompt = (prompt: string, provider: ImageBenchmarkProvider, image: ImageFileReference): string => [
  'Evaluate this generated image for an AutoShow image benchmark.',
  'Use the original generation prompt as the target. Score only visible image quality and prompt fit; do not reward or penalize provider cost or speed.',
  'Score each criterion from 1 to 10, where 10 is excellent and 1 is unusable.',
  '',
  `Provider/model: ${provider.providerKey}`,
  `Image file: ${image.fileName}`,
  '',
  'Original generation prompt:',
  prompt,
  '',
  'Criteria:',
  '- promptAdherence: how completely the image follows the requested subject, style, structure, and constraints.',
  '- visualQuality: overall aesthetic quality, clarity, lighting/color, and generation fidelity.',
  '- artifactControl: absence of obvious distortions, malformed objects, noise, seams, or rendering errors.',
  '- composition: layout, balance, hierarchy, framing, and readability of the intended scene.',
  '- detailTextHandling: fine detail quality and any visible text/label handling required by the prompt.',
  '',
  'Return only the requested JSON.'
].join('\n')

const createImageJudgeRequestBody = async (
  prompt: string,
  provider: ImageBenchmarkProvider,
  image: ImageFileReference,
  model: string
): Promise<Record<string, unknown>> => ({
  model,
  input: [{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: buildImageJudgePrompt(prompt, provider, image)
      },
      {
        type: 'input_image',
        image_url: await imageDataUrl(image),
        detail: 'auto'
      }
    ]
  }],
  text: {
    verbosity: 'low',
    format: {
      type: 'json_schema',
      name: 'image_quality_evaluation',
      schema: IMAGE_JUDGE_SCHEMA,
      strict: true
    }
  }
})

const judgeImage = async (
  prompt: string,
  provider: ImageBenchmarkProvider,
  image: ImageFileReference,
  model: string
): Promise<ImageEvaluation> => {
  const config = getOpenAIClientConfig()
  const response = await createOpenAIResponse(
    config,
    await createImageJudgeRequestBody(prompt, provider, image, model)
  )
  const rawText = extractOpenAIResponseText(response) ?? ''
  if (!rawText.trim()) {
    throw new Error(`OpenAI image judge returned no text for ${provider.providerKey} ${image.fileName}.`)
  }

  const evaluation = parseImageJudgeResponse(rawText, image.fileName)
  return {
    ...evaluation,
    ...(isRecord(response.usage) ? { usage: response.usage } : {})
  }
}

const averageCriterionScores = (evaluations: readonly ImageEvaluation[]): ImageCriterionScores => ({
  promptAdherence: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.promptAdherence))),
  visualQuality: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.visualQuality))),
  artifactControl: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.artifactControl))),
  composition: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.composition))),
  detailTextHandling: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.detailTextHandling)))
})

const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)]

const providerEvidence = (evaluations: readonly ImageEvaluation[]): ImageQualityProviderReport['evidence'] => ({
  summary: evaluations.map((evaluation) => `${evaluation.fileName}: ${evaluation.summary}`).join(' '),
  strengths: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.strengths)),
  issues: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.issues))
})

const evaluateProvider = async (
  prompt: string,
  provider: ImageBenchmarkProvider,
  judgeModel: string
): Promise<Omit<ImageQualityProviderReport, 'rank'>> => {
  const images: ImageEvaluation[] = []
  for (const image of provider.images) {
    l.write('info', `Judging image: ${provider.providerKey} ${image.fileName}`)
    images.push(await judgeImage(prompt, provider, image, judgeModel))
  }

  const criterionScores = averageCriterionScores(images)
  const averageScore10 = round2(average(images.map((image) => image.averageScore10)))
  const qualityScore = round2(average(images.map((image) => image.qualityScore)))

  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    imageFiles: provider.images.map((image) => image.fileName),
    imageCount: provider.images.length,
    ...(provider.processingTimeMs !== undefined ? { processingTimeMs: provider.processingTimeMs } : {}),
    ...(provider.costCents !== undefined ? { costCents: provider.costCents } : {}),
    criterionScores,
    averageScore10,
    qualityScore,
    qualityMetric: QUALITY_METRIC_NAME,
    evidence: providerEvidence(images),
    images
  }
}

const rankProviders = (
  providers: readonly Omit<ImageQualityProviderReport, 'rank'>[]
): ImageQualityProviderReport[] =>
  providers
    .slice()
    .sort((left, right) => right.qualityScore - left.qualityScore || left.providerKey.localeCompare(right.providerKey))
    .map((provider, index) => ({ rank: index + 1, ...provider }))

const escapeCell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ')

const formatScore = (value: number): string => value.toFixed(2)

const formatSeconds = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `${(value / 1000).toFixed(2)}s`

const formatCost = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `$${(value / 100).toFixed(4)}`

const writeImageQualityMarkdown = async (path: string, report: ImageQualityReport): Promise<void> => {
  const lines = [
    '# Image Quality Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Judge model: \`${report.judge.model}\``,
    `- Providers: ${report.providerCount}`,
    `- Images scored: ${report.imageCount}`,
    '',
    '## Ranking',
    '',
    '| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Composition | Detail/Text | Evidence |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ]

  for (const provider of report.providers) {
    lines.push(`| ${provider.rank} | \`${escapeCell(provider.providerKey)}\` | ${formatScore(provider.qualityScore)} | ${formatScore(provider.averageScore10)} | ${formatScore(provider.criterionScores.promptAdherence)} | ${formatScore(provider.criterionScores.visualQuality)} | ${formatScore(provider.criterionScores.artifactControl)} | ${formatScore(provider.criterionScores.composition)} | ${formatScore(provider.criterionScores.detailTextHandling)} | ${escapeCell(provider.evidence.summary)} |`)
  }

  lines.push(
    '',
    '## Rubric',
    '',
    '- Prompt adherence, visual quality, artifact control, composition, and detail/text handling are scored from 1 to 10.',
    '- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.',
    '- The score excludes cost, generation speed, file size, and provider latency.'
  )

  await Bun.write(path, `${lines.join('\n')}\n`)
}

const surfaceEntry = (
  row: JsonObject,
  index: number,
  metric: string,
  value: number | null,
  label: string
): JsonObject => ({
  rank: index + 1,
  providerKey: getString(row, 'providerKey') ?? 'unknown',
  provider: getString(row, 'provider') ?? getString(row, 'providerKey') ?? 'unknown',
  model: row['model'] ?? null,
  group: getString(row, 'group') ?? 'service',
  metric,
  value,
  label
})

const compareOptionalAscending = (left: number | undefined, right: number | undefined): number => {
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

const fullRankingSurface = (
  rows: readonly JsonObject[],
  metric: string,
  valueForRow: (row: JsonObject) => number | undefined,
  labelForValue: (value: number) => string
): JsonObject[] =>
  rows
    .map((row) => ({ row, value: valueForRow(row) }))
    .sort((left, right) => {
      const delta = compareOptionalAscending(left.value, right.value)
      return delta || (getString(left.row, 'providerKey') ?? '').localeCompare(getString(right.row, 'providerKey') ?? '')
    })
    .map((entry, index) =>
      surfaceEntry(
        entry.row,
        index,
        metric,
        entry.value ?? null,
        entry.value === undefined ? 'n/a' : labelForValue(entry.value)
      )
    )

const qualityRankingSurface = (
  rows: readonly JsonObject[],
  metric: string,
  labelForValue: (value: number) => string
): JsonObject[] =>
  rows
    .map((row) => ({ row, value: getNumber(row, metric) }))
    .filter((entry): entry is { row: JsonObject, value: number } => entry.value !== undefined)
    .sort((left, right) =>
      right.value - left.value || (getString(left.row, 'providerKey') ?? '').localeCompare(getString(right.row, 'providerKey') ?? '')
    )
    .map((entry, index) => surfaceEntry(entry.row, index, metric, entry.value, labelForValue(entry.value)))

const unavailableReason = (rows: readonly JsonObject[], surfaceRows: readonly JsonObject[], label: string): string | null => {
  if (rows.length === 0) {
    return 'No providers were found.'
  }
  return surfaceRows.length === 0 ? `No ${label} metric was available for these providers.` : null
}

const providerComparisonRows = (report: ImageQualityReport): JsonObject[] =>
  report.providers
    .slice()
    .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
    .map((provider) => ({
      rank: provider.rank,
      providerKey: provider.providerKey,
      provider: provider.providerKey,
      model: null,
      group: provider.group,
      processingTimeMs: provider.processingTimeMs ?? null,
      actualProcessingTimeMs: provider.processingTimeMs ?? null,
      costCents: provider.costCents ?? null,
      actualCostCents: provider.costCents ?? null,
      qualityScore: provider.qualityScore,
      qualityMetric: provider.qualityMetric,
      qualityValue: provider.qualityScore,
      qualityLabel: `${formatScore(provider.qualityScore)}/100`,
      metrics: {
        wer: null,
        cer: null,
        speakerAwareWER: null,
        textOnlyWER: null,
        roundtripWER: null,
        contentCoverage: null,
        qualityScore: provider.qualityScore
      },
      supportsDiarization: null,
      diarizationSupport: null,
      tierGroup: null,
      groupOverallRank: null,
      groupTier: null,
      qualityWarnings: [],
      segmentStats: null,
      duplicateGroupId: null,
      imageQuality: {
        judgeModel: report.judge.model,
        qualityScore: provider.qualityScore,
        averageScore10: provider.averageScore10,
        criterionScores: provider.criterionScores,
        imageCount: provider.imageCount,
        imageFiles: provider.imageFiles,
        evidence: provider.evidence
      }
    }))

const buildRankingSurfaces = (rows: readonly JsonObject[]): JsonObject => {
  const groups = {
    local: rows.filter((row) => getString(row, 'group') === 'local'),
    service: rows.filter((row) => getString(row, 'group') !== 'local')
  }

  const buildGroup = (groupRows: readonly JsonObject[]): JsonObject => {
    const price = fullRankingSurface(
      groupRows,
      'costCents',
      (row) => getString(row, 'group') === 'local' ? 0 : getNumber(row, 'costCents'),
      (value) => getString(groupRows[0] ?? {}, 'group') === 'local' ? '$0.00 local monetary cost' : formatCost(value)
    )
    const speed = fullRankingSurface(groupRows, 'processingTimeMs', (row) => getNumber(row, 'processingTimeMs'), (value) => formatSeconds(value))
    const automatedQuality = qualityRankingSurface(groupRows, 'qualityScore', (value) => `${formatScore(value)}/100`)
    const humanQuality: JsonObject[] = []
    const qualityAlias = humanQuality.length > 0 ? humanQuality : automatedQuality

    return {
      fastest: speed,
      cheapest: price,
      highestQuality: qualityAlias,
      fastestUnavailableReason: speed.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      cheapestUnavailableReason: price.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      highestQualityUnavailableReason: unavailableReason(groupRows, qualityAlias, 'image quality'),
      price,
      speed,
      automatedQuality,
      humanQuality,
      priceUnavailableReason: price.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      speedUnavailableReason: speed.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      automatedQualityUnavailableReason: unavailableReason(groupRows, automatedQuality, 'image quality'),
      humanQualityUnavailableReason: groupRows.length === 0
        ? 'No providers were found.'
        : 'No explicit humanQualityScore was available for these providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.'
    }
  }

  return {
    local: buildGroup(groups.local),
    service: buildGroup(groups.service)
  }
}

const writeProviderComparisonMarkdown = async (
  path: string,
  report: ImageQualityReport,
  rows: readonly JsonObject[],
  rankingSurfaces: JsonObject
): Promise<void> => {
  const lines = [
    '# Image Provider Comparison Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Total providers: ${report.providerCount}`,
    `- Judge model: \`${report.judge.model}\``,
    '- Local and service providers are intentionally not ranked against each other.',
    '',
    '## Method',
    '',
    '- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.',
    '- Speed rankings use processing time when present; missing timing stays in the ranking at the end.',
    '- Automated quality rankings use the explicit OpenAI vision judge score from `image-quality-report.json`.',
    '- Human quality rankings use only explicit `humanQualityScore` evidence.',
    '- File size, dimensions, latency, and cost are not used as quality proxies.',
    ''
  ]

  for (const group of ['local', 'service'] as const) {
    const title = group === 'local' ? 'Local Providers' : 'Service Providers'
    const groupRows = rows.filter((row) => getString(row, 'group') === group)
    const surfaces = getObject(rankingSurfaces, group) ?? {}
    lines.push(`## ${title}`, '')

    for (const [heading, key] of [
      ['Price', 'price'],
      ['Speed', 'speed'],
      ['Automated Quality', 'automatedQuality'],
      ['Human Quality', 'humanQuality']
    ] as const) {
      const surfaceRows = getArray(surfaces, key).filter(isRecord)
      const reason = getString(surfaces, `${key}UnavailableReason`)
      lines.push(`### ${heading}`, '')
      if (surfaceRows.length === 0) {
        lines.push(`Unavailable: ${reason ?? 'No eligible providers were found.'}`, '')
        continue
      }

      lines.push('| Rank | Provider | Evidence |', '| ---: | --- | --- |')
      for (const surface of surfaceRows) {
        lines.push(`| ${getNumber(surface, 'rank') ?? ''} | \`${escapeCell(getString(surface, 'providerKey') ?? 'unknown')}\` | ${escapeCell(getString(surface, 'label') ?? '')} |`)
      }
      lines.push('')
    }

    lines.push('### Provider Detail', '')
    if (groupRows.length === 0) {
      lines.push(`No ${group} providers were found.`, '')
      continue
    }

    lines.push('| Provider | Quality Evidence | Processing Time | Monetary Cost |', '| --- | --- | ---: | ---: |')
    for (const row of groupRows) {
      lines.push(`| \`${escapeCell(getString(row, 'providerKey') ?? 'unknown')}\` | ${escapeCell(getString(row, 'qualityLabel') ?? 'n/a')} | ${formatSeconds(getNumber(row, 'processingTimeMs'))} | ${formatCost(getNumber(row, 'costCents'))} |`)
    }
    lines.push('')
  }

  lines.push(
    '## Notes',
    '',
    '- Image mode evaluates existing generated images only; it does not generate new images.',
    '- Quality scores are explicit judge scores and are not inferred from file size, dimensions, latency, or cost.'
  )

  await Bun.write(path, `${lines.join('\n')}\n`)
}

const writeProviderComparisonReports = async (
  runDir: string,
  report: ImageQualityReport
): Promise<{ jsonOut: string, markdownOut: string }> => {
  const rows = providerComparisonRows(report)
  const localProviders = rows.filter((row) => getString(row, 'group') === 'local')
  const serviceProviders = rows.filter((row) => getString(row, 'group') !== 'local')
  const rankingSurfaces = buildRankingSurfaces(rows)
  const jsonOut = join(runDir, 'provider-comparison-report.json')
  const markdownOut = join(runDir, 'provider-comparison-report.md')

  const comparisonReport: JsonObject = {
    schemaVersion: 2,
    kind: 'image-provider-comparison',
    category: 'image',
    runDir,
    runName: basename(runDir),
    generatedAt: report.generatedAt,
    metric: 'image-quality-price-speed',
    scoreFormula: 'Automated quality ranking uses OpenAI image quality score; price and speed surfaces remain independent.',
    tiering: null,
    duplicateGroups: [],
    normalization: null,
    providerCount: report.providerCount,
    providerGroups: {
      local: {
        count: localProviders.length,
        providers: localProviders
      },
      service: {
        count: serviceProviders.length,
        providers: serviceProviders
      }
    },
    providers: rows,
    rankingSurfaces,
    combinedLeaderboardPolicy: 'omitted: local and service providers are not ranked against each other',
    notes: [
      'Automated quality rankings use explicit image judge scores from image-quality-report.json.',
      'Price and speed surfaces are evidence-only and do not affect image quality scores.',
      'Image mode evaluates existing generated images only; it does not generate new images.'
    ]
  }

  await Bun.write(jsonOut, `${JSON.stringify(comparisonReport, null, 2)}\n`)
  await writeProviderComparisonMarkdown(markdownOut, report, rows, rankingSurfaces)

  return { jsonOut, markdownOut }
}

const writeImageQualityReports = async (
  runDir: string,
  runJson: ImageRunJson,
  providers: readonly ImageBenchmarkProvider[],
  judgeModel: string
): Promise<{ report: ImageQualityReport, jsonOut: string, markdownOut: string }> => {
  const generatedAt = new Date().toISOString()
  const evaluatedProviders: Array<Omit<ImageQualityProviderReport, 'rank'>> = []

  for (const provider of providers) {
    evaluatedProviders.push(await evaluateProvider(runJson.metadata.input, provider, judgeModel))
  }

  const report: ImageQualityReport = {
    schemaVersion: 1,
    kind: 'image-quality-report',
    runDir,
    runName: basename(runDir),
    generatedAt,
    judge: {
      provider: 'openai',
      model: judgeModel,
      endpoint: 'responses'
    },
    prompt: runJson.metadata.input,
    rubric: {
      scale: '1-10',
      qualityScore: 'average criterion score x 10',
      criteria: [...IMAGE_QUALITY_CRITERIA]
    },
    providerCount: evaluatedProviders.length,
    imageCount: evaluatedProviders.reduce((sum, provider) => sum + provider.imageCount, 0),
    providers: rankProviders(evaluatedProviders)
  }

  const jsonOut = join(runDir, 'image-quality-report.json')
  const markdownOut = join(runDir, 'image-quality-report.md')
  await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  await writeImageQualityMarkdown(markdownOut, report)

  return { report, jsonOut, markdownOut }
}

export const runImageBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('Image run directory is required. Usage: bun as benchmark <image-run-dir> --image')
  }

  const runDir = resolve(input)
  const runJson = await loadImageRunJson(runDir)
  const providers = await resolveImageProviders(runDir, runJson)
  const judgeModel = flags['image-judge-model'] ?? DEFAULT_IMAGE_JUDGE_MODEL

  l.write('info', 'Image Benchmark Input', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['providers', providers.length],
      ['images', providers.reduce((sum, provider) => sum + provider.images.length, 0)],
      ['judgeModel', judgeModel]
    ]),
    metadata: {
      runDir,
      providerCount: providers.length,
      imageCount: providers.reduce((sum, provider) => sum + provider.images.length, 0),
      judgeModel
    }
  })

  const { report, jsonOut, markdownOut } = await writeImageQualityReports(runDir, runJson, providers, judgeModel)
  const comparison = await writeProviderComparisonReports(runDir, report)

  l.write('info', 'Image Benchmark Report', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['qualityJson', jsonOut],
      ['qualityMarkdown', markdownOut],
      ['comparisonJson', comparison.jsonOut],
      ['comparisonMarkdown', comparison.markdownOut]
    ]),
    metadata: {
      jsonOut,
      markdownOut,
      comparisonJsonOut: comparison.jsonOut,
      comparisonMarkdownOut: comparison.markdownOut
    }
  })

  l.write('info', 'Image Quality Rankings', {
    category: 'pipeline',
    humanTable: createHumanTable(
      report.providers.slice(0, 10).map((provider) => ({
        rank: provider.rank,
        providerModel: provider.providerKey,
        qualityScore: formatScore(provider.qualityScore)
      })),
      ['rank', 'providerModel', 'qualityScore']
    ),
    metadata: {
      rankings: report.providers.slice(0, 10).map((provider) => ({
        rank: provider.rank,
        providerKey: provider.providerKey,
        qualityScore: provider.qualityScore
      }))
    }
  })
}
