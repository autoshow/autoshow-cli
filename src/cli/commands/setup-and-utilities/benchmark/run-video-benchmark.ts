import { mkdir, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, resolve } from 'node:path'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { exec } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { createHumanTable, createKeyValueTable } from '~/utils/logger/human-table'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/client'
import type { BenchmarkFlags } from './benchmark-types'

type JsonObject = Record<string, unknown>

type VideoRunEntry = {
  videoGenService: string
  videoGenModel: string
  videoFileName: string
  processingTimeMs?: number
  costCents?: number
  videoDuration?: number
}

type VideoRunJson = {
  kind: 'video'
  metadata: {
    input: string
    video: VideoRunEntry[]
  }
  raw: JsonObject
}

type VideoFileReference = {
  fileName: string
  path: string
  metadataDurationSeconds?: number
}

type VideoBenchmarkProvider = {
  providerKey: string
  provider: string
  model: string
  group: 'local' | 'service'
  processingTimeMs?: number
  costCents?: number
  videos: VideoFileReference[]
}

type VideoFrame = {
  index: number
  timestampSeconds: number
  fileName: string
  path: string
}

type VideoCriterionScores = {
  promptAdherence: number
  visualQuality: number
  artifactControl: number
  temporalConsistency: number
  compositionCamera: number
}

type VideoEvaluation = {
  fileName: string
  durationSeconds: number
  frameCount: number
  frames: VideoFrame[]
  criterionScores: VideoCriterionScores
  averageScore10: number
  qualityScore: number
  summary: string
  strengths: string[]
  issues: string[]
  usage?: JsonObject
}

type VideoQualityProviderReport = {
  rank: number
  providerKey: string
  provider: string
  model: string
  group: 'local' | 'service'
  videoFiles: string[]
  videoCount: number
  processingTimeMs?: number
  costCents?: number
  criterionScores: VideoCriterionScores
  averageScore10: number
  qualityScore: number
  qualityMetric: 'video quality score'
  evidence: {
    summary: string
    strengths: string[]
    issues: string[]
    frameCount: number
    frames: Array<{
      videoFileName: string
      index: number
      timestampSeconds: number
      fileName: string
    }>
  }
  videos: VideoEvaluation[]
}

type VideoQualityReport = {
  schemaVersion: 1
  kind: 'video-quality-report'
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
    frameSampling: '10 midpoint-interval screenshots per video'
    criteria: string[]
  }
  providerCount: number
  videoCount: number
  frameCount: number
  providers: VideoQualityProviderReport[]
}

const DEFAULT_VIDEO_JUDGE_MODEL = 'gpt-5.5'
const QUALITY_METRIC_NAME = 'video quality score'
const VIDEO_FRAME_COUNT = 10

const VIDEO_QUALITY_CRITERIA = [
  'prompt adherence',
  'visual quality',
  'artifact control',
  'temporal consistency',
  'composition/camera'
] as const

const VIDEO_JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'promptAdherence',
    'visualQuality',
    'artifactControl',
    'temporalConsistency',
    'compositionCamera',
    'summary',
    'strengths',
    'issues'
  ],
  properties: {
    promptAdherence: { type: 'integer', minimum: 1, maximum: 10 },
    visualQuality: { type: 'integer', minimum: 1, maximum: 10 },
    artifactControl: { type: 'integer', minimum: 1, maximum: 10 },
    temporalConsistency: { type: 'integer', minimum: 1, maximum: 10 },
    compositionCamera: { type: 'integer', minimum: 1, maximum: 10 },
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

const optionalAverage = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : round2(average(values))

const providerKey = (service: string, model: string): string => `${service}/${model}`

const providerGroup = (service: string): 'local' | 'service' =>
  service === 'local' ? 'local' : 'service'

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

const parseVideoRunEntry = (
  rawEntry: JsonObject,
  rawRunJson: JsonObject,
  index: number
): VideoRunEntry => {
  const videoGenService = getString(rawEntry, 'videoGenService')
  const videoGenModel = getString(rawEntry, 'videoGenModel')
  const videoFileName = getString(rawEntry, 'videoFileName')
  if (!videoGenService || !videoGenModel || !videoFileName) {
    throw CLIUsageError(`Video benchmark metadata.video[${index}] must include videoGenService, videoGenModel, and videoFileName.`)
  }

  const processingTimeMs = getNumber(rawEntry, 'processingTime')
  const costCents = getNumber(rawEntry, 'providerCostCents') ?? costFromRunCostSteps(rawRunJson, videoGenService, videoGenModel)
  const videoDuration = getNumber(rawEntry, 'videoDuration')

  return {
    videoGenService,
    videoGenModel,
    videoFileName,
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {}),
    ...(videoDuration !== undefined ? { videoDuration } : {})
  }
}

const loadVideoRunJson = async (runDir: string): Promise<VideoRunJson> => {
  await ensureDirectory(runDir, 'Video run directory')

  const runJsonPath = join(runDir, 'run.json')
  await ensureFile(runJsonPath, `Video run directory is missing run.json: ${runJsonPath}`)

  let rawJson: unknown
  try {
    rawJson = JSON.parse(await Bun.file(runJsonPath).text()) as unknown
  } catch (error) {
    throw CLIUsageError(`Video benchmark run.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!isRecord(rawJson)) {
    throw CLIUsageError('Video benchmark run.json must be a JSON object.')
  }

  const kind = getString(rawJson, 'kind')
  if (kind !== 'video') {
    throw CLIUsageError(`run.json kind is "${kind ?? 'unknown'}", expected "video"`)
  }

  const metadata = getObject(rawJson, 'metadata')
  if (!metadata) {
    throw CLIUsageError('Video benchmark run.json is missing metadata.')
  }

  const input = getString(metadata, 'input')
  if (!input) {
    throw CLIUsageError('Video benchmark source prompt is missing. This run.json must contain metadata.input.')
  }

  const videoEntries = getArray(metadata, 'video')
  if (videoEntries.length === 0) {
    throw CLIUsageError('Video benchmark run.json must contain metadata.video[].')
  }

  const video = videoEntries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw CLIUsageError(`Video benchmark metadata.video[${index}] must be an object.`)
    }
    return parseVideoRunEntry(entry, rawJson, index)
  })

  return {
    kind: 'video',
    metadata: {
      input,
      video
    },
    raw: rawJson
  }
}

const resolveVideoProviders = async (
  runDir: string,
  runJson: VideoRunJson
): Promise<VideoBenchmarkProvider[]> => {
  const groups = new Map<string, Array<{
    entry: VideoRunEntry
    video: VideoFileReference
  }>>()

  for (const entry of runJson.metadata.video) {
    if (isAbsolute(entry.videoFileName)) {
      throw CLIUsageError(`Video benchmark videoFileName must be relative to the run directory: ${entry.videoFileName}`)
    }

    const videoPath = resolve(runDir, entry.videoFileName)
    await ensureFile(videoPath, `Video benchmark video file not found: ${videoPath}`)

    const key = providerKey(entry.videoGenService, entry.videoGenModel)
    const group = groups.get(key) ?? []
    group.push({
      entry,
      video: {
        fileName: entry.videoFileName,
        path: videoPath,
        ...(entry.videoDuration !== undefined ? { metadataDurationSeconds: entry.videoDuration } : {})
      }
    })
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, entries]) => {
      const first = entries[0]
      if (!first) {
        throw new Error(`Internal error: empty video provider group ${key}`)
      }

      const processingTimeMs = optionalAverage(entries
        .map(({ entry }) => entry.processingTimeMs)
        .filter((value): value is number => value !== undefined))
      const costCents = optionalAverage(entries
        .map(({ entry }) => entry.costCents)
        .filter((value): value is number => value !== undefined))

      return {
        providerKey: key,
        provider: first.entry.videoGenService,
        model: first.entry.videoGenModel,
        group: providerGroup(first.entry.videoGenService),
        ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
        ...(costCents !== undefined ? { costCents } : {}),
        videos: entries.map(({ video }) => video)
      }
    })
    .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
}

const requireVideoTools = (): void => {
  const missing = ['ffmpeg', 'ffprobe'].filter((command) => Bun.which(command) === null)
  if (missing.length > 0) {
    throw CLIUsageError(`benchmark --video requires ${missing.join(' and ')} to extract quality frames. Install ffmpeg/ffprobe and rerun.`)
  }
}

const parseDuration = (raw: string): number | undefined => {
  const duration = Number.parseFloat(raw.trim())
  return Number.isFinite(duration) && duration > 0 ? duration : undefined
}

const probeVideoDuration = async (video: VideoFileReference): Promise<number> => {
  const result = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    video.path
  ])
  const probedDuration = result.exitCode === 0 ? parseDuration(result.stdout) : undefined
  if (probedDuration !== undefined) {
    return probedDuration
  }

  if (video.metadataDurationSeconds !== undefined && video.metadataDurationSeconds > 0) {
    return video.metadataDurationSeconds
  }

  const stderr = result.stderr.trim()
  throw CLIUsageError(`Could not determine video duration for ${video.fileName}. ffprobe failed${stderr ? `: ${stderr}` : ''} and metadata.videoDuration is missing.`)
}

const slugPart = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'video'
}

const videoStem = (fileName: string): string => {
  const extension = extname(fileName)
  return basename(fileName, extension)
}

const formatTimestampArg = (seconds: number): string => seconds.toFixed(3)

const extractFrameAtTimestamp = async (
  video: VideoFileReference,
  framePath: string,
  timestampSeconds: number
): Promise<boolean> => {
  const result = await exec('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', formatTimestampArg(timestampSeconds),
    '-i', video.path,
    '-frames:v', '1',
    '-y',
    framePath
  ])
  return result.exitCode === 0 && await Bun.file(framePath).exists()
}

const fallbackTimestamp = (timestampSeconds: number, durationSeconds: number): number => {
  const backoff = Math.min(Math.max(durationSeconds / VIDEO_FRAME_COUNT, 0.1), Math.max(durationSeconds / 2, 0.001))
  return Math.max(0, Math.min(timestampSeconds - 0.001, durationSeconds - backoff))
}

const extractVideoFrames = async (
  runDir: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference
): Promise<{ durationSeconds: number, frames: VideoFrame[] }> => {
  const durationSeconds = await probeVideoDuration(video)
  const providerSlug = slugPart(`${provider.provider}-${provider.model}`)
  const stem = slugPart(videoStem(video.fileName))
  const frameDir = join(runDir, 'video-quality-frames', providerSlug, stem)
  await mkdir(frameDir, { recursive: true })

  const frames: VideoFrame[] = []
  for (let index = 0; index < VIDEO_FRAME_COUNT; index++) {
    const timestampSeconds = round2(((index + 0.5) * durationSeconds) / VIDEO_FRAME_COUNT)
    const frameName = `frame-${String(index + 1).padStart(2, '0')}.png`
    const framePath = join(frameDir, frameName)
    const extracted = await extractFrameAtTimestamp(video, framePath, timestampSeconds)
      || await extractFrameAtTimestamp(video, framePath, fallbackTimestamp(timestampSeconds, durationSeconds))
    if (!extracted) {
      throw CLIUsageError(`Failed to extract video benchmark frame ${index + 1} from ${video.fileName}: ffmpeg did not write ${frameName}`)
    }
    frames.push({
      index: index + 1,
      timestampSeconds,
      fileName: framePath.slice(runDir.length + 1),
      path: framePath
    })
  }

  return {
    durationSeconds,
    frames
  }
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

  throw new Error('OpenAI video judge response was not a JSON object.')
}

const requireScore = (object: JsonObject, key: keyof VideoCriterionScores): number => {
  const value = getNumber(object, key)
  if (value === undefined || value < 1 || value > 10) {
    throw new Error(`OpenAI video judge response field ${key} must be a number from 1 through 10.`)
  }
  return value
}

const stringArray = (object: JsonObject, key: string): string[] =>
  getArray(object, key)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())

export const parseVideoJudgeResponse = (
  rawText: string,
  video: VideoFileReference,
  durationSeconds: number,
  frames: VideoFrame[]
): VideoEvaluation => {
  const parsed = parseJsonObjectFromText(rawText)
  const criterionScores: VideoCriterionScores = {
    promptAdherence: requireScore(parsed, 'promptAdherence'),
    visualQuality: requireScore(parsed, 'visualQuality'),
    artifactControl: requireScore(parsed, 'artifactControl'),
    temporalConsistency: requireScore(parsed, 'temporalConsistency'),
    compositionCamera: requireScore(parsed, 'compositionCamera')
  }
  const averageScore10 = round2(average(Object.values(criterionScores)))
  const summary = getString(parsed, 'summary')
  if (!summary) {
    throw new Error('OpenAI video judge response field summary must be a non-empty string.')
  }

  return {
    fileName: video.fileName,
    durationSeconds: round2(durationSeconds),
    frameCount: frames.length,
    frames,
    criterionScores,
    averageScore10,
    qualityScore: round2(averageScore10 * 10),
    summary,
    strengths: stringArray(parsed, 'strengths'),
    issues: stringArray(parsed, 'issues')
  }
}

const frameDataUrl = async (frame: VideoFrame): Promise<string> => {
  const bytes = await Bun.file(frame.path).arrayBuffer()
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

const buildVideoJudgePrompt = (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  frames: readonly VideoFrame[]
): string => [
  'Evaluate this generated video for an AutoShow video benchmark using the ordered screenshots as the video evidence.',
  'Use the original generation prompt as the target. Score only visible video quality, prompt fit, and temporal coherence implied by the ordered frames; do not reward or penalize provider cost or speed.',
  'Score each criterion from 1 to 10, where 10 is excellent and 1 is unusable.',
  '',
  `Provider/model: ${provider.providerKey}`,
  `Video file: ${video.fileName}`,
  `Screenshots: ${frames.length} ordered frames sampled at midpoint intervals`,
  '',
  'Original generation prompt:',
  prompt,
  '',
  'Ordered frame timestamps:',
  ...frames.map((frame) => `- frame-${String(frame.index).padStart(2, '0')}: ${frame.timestampSeconds}s`),
  '',
  'Criteria:',
  '- promptAdherence: how completely the video follows the requested subject, actions, style, structure, and constraints.',
  '- visualQuality: overall aesthetic quality, clarity, lighting/color, and generation fidelity across frames.',
  '- artifactControl: absence of obvious distortions, malformed objects, noise, flicker, warping, or rendering errors.',
  '- temporalConsistency: consistency of subjects, identity, motion continuity, physics, and scene state across ordered frames.',
  '- compositionCamera: framing, camera movement/readability, layout, balance, and shot coherence.',
  '',
  'Return only the requested JSON.'
].join('\n')

const createVideoJudgeRequestBody = async (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  frames: readonly VideoFrame[],
  model: string
): Promise<Record<string, unknown>> => ({
  model,
  input: [{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: buildVideoJudgePrompt(prompt, provider, video, frames)
      },
      ...(await Promise.all(frames.map(async (frame) => ({
        type: 'input_image',
        image_url: await frameDataUrl(frame),
        detail: 'auto'
      }))))
    ]
  }],
  text: {
    verbosity: 'low',
    format: {
      type: 'json_schema',
      name: 'video_quality_evaluation',
      schema: VIDEO_JUDGE_SCHEMA,
      strict: true
    }
  }
})

const judgeVideo = async (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  model: string,
  durationSeconds: number,
  frames: VideoFrame[]
): Promise<VideoEvaluation> => {
  const config = getOpenAIClientConfig()
  const response = await createOpenAIResponse(
    config,
    await createVideoJudgeRequestBody(prompt, provider, video, frames, model)
  )
  const rawText = extractOpenAIResponseText(response) ?? ''
  if (!rawText.trim()) {
    throw new Error(`OpenAI video judge returned no text for ${provider.providerKey} ${video.fileName}.`)
  }

  const evaluation = parseVideoJudgeResponse(rawText, video, durationSeconds, frames)
  return {
    ...evaluation,
    ...(isRecord(response.usage) ? { usage: response.usage } : {})
  }
}

const averageCriterionScores = (evaluations: readonly VideoEvaluation[]): VideoCriterionScores => ({
  promptAdherence: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.promptAdherence))),
  visualQuality: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.visualQuality))),
  artifactControl: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.artifactControl))),
  temporalConsistency: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.temporalConsistency))),
  compositionCamera: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.compositionCamera)))
})

const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)]

const providerEvidence = (evaluations: readonly VideoEvaluation[]): VideoQualityProviderReport['evidence'] => ({
  summary: evaluations.map((evaluation) => `${evaluation.fileName}: ${evaluation.summary}`).join(' '),
  strengths: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.strengths)),
  issues: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.issues)),
  frameCount: evaluations.reduce((sum, evaluation) => sum + evaluation.frameCount, 0),
  frames: evaluations.flatMap((evaluation) =>
    evaluation.frames.map((frame) => ({
      videoFileName: evaluation.fileName,
      index: frame.index,
      timestampSeconds: frame.timestampSeconds,
      fileName: frame.fileName
    }))
  )
})

const evaluateProvider = async (
  runDir: string,
  prompt: string,
  provider: VideoBenchmarkProvider,
  judgeModel: string
): Promise<Omit<VideoQualityProviderReport, 'rank'>> => {
  const videos: VideoEvaluation[] = []
  for (const video of provider.videos) {
    l.write('info', `Extracting video quality frames: ${provider.providerKey} ${video.fileName}`)
    const { durationSeconds, frames } = await extractVideoFrames(runDir, provider, video)
    l.write('info', `Judging video: ${provider.providerKey} ${video.fileName}`)
    videos.push(await judgeVideo(prompt, provider, video, judgeModel, durationSeconds, frames))
  }

  const criterionScores = averageCriterionScores(videos)
  const averageScore10 = round2(average(videos.map((video) => video.averageScore10)))
  const qualityScore = round2(average(videos.map((video) => video.qualityScore)))

  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    videoFiles: provider.videos.map((video) => video.fileName),
    videoCount: provider.videos.length,
    ...(provider.processingTimeMs !== undefined ? { processingTimeMs: provider.processingTimeMs } : {}),
    ...(provider.costCents !== undefined ? { costCents: provider.costCents } : {}),
    criterionScores,
    averageScore10,
    qualityScore,
    qualityMetric: QUALITY_METRIC_NAME,
    evidence: providerEvidence(videos),
    videos
  }
}

const rankProviders = (
  providers: readonly Omit<VideoQualityProviderReport, 'rank'>[]
): VideoQualityProviderReport[] =>
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

const writeVideoQualityMarkdown = async (path: string, report: VideoQualityReport): Promise<void> => {
  const lines = [
    '# Video Quality Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Judge model: \`${report.judge.model}\``,
    `- Providers: ${report.providerCount}`,
    `- Videos scored: ${report.videoCount}`,
    `- Frames scored: ${report.frameCount}`,
    '',
    '## Ranking',
    '',
    '| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Temporal | Composition/Camera | Evidence |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ]

  for (const provider of report.providers) {
    lines.push(`| ${provider.rank} | \`${escapeCell(provider.providerKey)}\` | ${formatScore(provider.qualityScore)} | ${formatScore(provider.averageScore10)} | ${formatScore(provider.criterionScores.promptAdherence)} | ${formatScore(provider.criterionScores.visualQuality)} | ${formatScore(provider.criterionScores.artifactControl)} | ${formatScore(provider.criterionScores.temporalConsistency)} | ${formatScore(provider.criterionScores.compositionCamera)} | ${escapeCell(provider.evidence.summary)} |`)
  }

  lines.push(
    '',
    '## Rubric',
    '',
    '- Prompt adherence, visual quality, artifact control, temporal consistency, and composition/camera are scored from 1 to 10.',
    '- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.',
    '- Each video is judged from exactly 10 midpoint-interval screenshots in one vision request.',
    '- The score excludes cost, generation speed, file size, provider latency, and audio.'
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

const providerComparisonRows = (report: VideoQualityReport): JsonObject[] =>
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
      videoQuality: {
        judgeModel: report.judge.model,
        qualityScore: provider.qualityScore,
        averageScore10: provider.averageScore10,
        criterionScores: provider.criterionScores,
        videoCount: provider.videoCount,
        videoFiles: provider.videoFiles,
        frameCount: provider.evidence.frameCount,
        frameTimestamps: provider.evidence.frames.map((frame) => frame.timestampSeconds),
        frameFiles: provider.evidence.frames.map((frame) => frame.fileName),
        evidence: {
          judgeModel: report.judge.model,
          frameCount: provider.evidence.frameCount,
          frames: provider.evidence.frames,
          criterionScores: provider.criterionScores,
          summary: provider.evidence.summary,
          strengths: provider.evidence.strengths,
          issues: provider.evidence.issues
        }
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
      highestQualityUnavailableReason: unavailableReason(groupRows, qualityAlias, 'video quality'),
      price,
      speed,
      automatedQuality,
      humanQuality,
      priceUnavailableReason: price.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      speedUnavailableReason: speed.length === 0 && groupRows.length === 0 ? 'No providers were found.' : null,
      automatedQualityUnavailableReason: unavailableReason(groupRows, automatedQuality, 'video quality'),
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
  report: VideoQualityReport,
  rows: readonly JsonObject[],
  rankingSurfaces: JsonObject
): Promise<void> => {
  const lines = [
    '# Video Provider Comparison Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Total providers: ${report.providerCount}`,
    `- Videos scored: ${report.videoCount}`,
    `- Frames scored: ${report.frameCount}`,
    `- Judge model: \`${report.judge.model}\``,
    '- Local and service providers are intentionally not ranked against each other.',
    '',
    '## Method',
    '',
    '- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.',
    '- Speed rankings use processing time when present; missing timing stays in the ranking at the end.',
    '- Automated quality rankings use the explicit OpenAI vision judge score from `video-quality-report.json`.',
    '- Human quality rankings use only explicit `humanQualityScore` evidence.',
    '- File size, duration, latency, and cost are not used as quality proxies.',
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
    '- Video mode evaluates existing generated videos only; it does not generate new videos.',
    '- Quality scores are explicit judge scores and are not inferred from file size, duration, latency, or cost.'
  )

  await Bun.write(path, `${lines.join('\n')}\n`)
}

const writeProviderComparisonReports = async (
  runDir: string,
  report: VideoQualityReport
): Promise<{ jsonOut: string, markdownOut: string }> => {
  const rows = providerComparisonRows(report)
  const localProviders = rows.filter((row) => getString(row, 'group') === 'local')
  const serviceProviders = rows.filter((row) => getString(row, 'group') !== 'local')
  const rankingSurfaces = buildRankingSurfaces(rows)
  const jsonOut = join(runDir, 'provider-comparison-report.json')
  const markdownOut = join(runDir, 'provider-comparison-report.md')

  const comparisonReport: JsonObject = {
    schemaVersion: 2,
    kind: 'video-provider-comparison',
    category: 'video',
    runDir,
    runName: basename(runDir),
    generatedAt: report.generatedAt,
    metric: 'video-quality-price-speed',
    scoreFormula: 'Automated quality ranking uses OpenAI video quality score; price and speed surfaces remain independent.',
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
      'Automated quality rankings use explicit video judge scores from video-quality-report.json.',
      'Price and speed surfaces are evidence-only and do not affect video quality scores.',
      'Video mode evaluates existing generated videos only; it does not generate new videos.'
    ]
  }

  await Bun.write(jsonOut, `${JSON.stringify(comparisonReport, null, 2)}\n`)
  await writeProviderComparisonMarkdown(markdownOut, report, rows, rankingSurfaces)

  return { jsonOut, markdownOut }
}

const writeVideoQualityReports = async (
  runDir: string,
  runJson: VideoRunJson,
  providers: readonly VideoBenchmarkProvider[],
  judgeModel: string
): Promise<{ report: VideoQualityReport, jsonOut: string, markdownOut: string }> => {
  const generatedAt = new Date().toISOString()
  const evaluatedProviders: Array<Omit<VideoQualityProviderReport, 'rank'>> = []

  for (const provider of providers) {
    evaluatedProviders.push(await evaluateProvider(runDir, runJson.metadata.input, provider, judgeModel))
  }

  const rankedProviders = rankProviders(evaluatedProviders)
  const report: VideoQualityReport = {
    schemaVersion: 1,
    kind: 'video-quality-report',
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
      frameSampling: '10 midpoint-interval screenshots per video',
      criteria: [...VIDEO_QUALITY_CRITERIA]
    },
    providerCount: rankedProviders.length,
    videoCount: rankedProviders.reduce((sum, provider) => sum + provider.videoCount, 0),
    frameCount: rankedProviders.reduce((sum, provider) => sum + provider.evidence.frameCount, 0),
    providers: rankedProviders
  }

  const jsonOut = join(runDir, 'video-quality-report.json')
  const markdownOut = join(runDir, 'video-quality-report.md')
  await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  await writeVideoQualityMarkdown(markdownOut, report)

  return { report, jsonOut, markdownOut }
}

export const runVideoBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('Video run directory is required. Usage: bun as benchmark <video-run-dir> --video')
  }

  const runDir = resolve(input)
  const runJson = await loadVideoRunJson(runDir)
  const providers = await resolveVideoProviders(runDir, runJson)
  requireVideoTools()

  const judgeModel = flags['video-judge-model'] ?? DEFAULT_VIDEO_JUDGE_MODEL

  l.write('info', 'Video Benchmark Input', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['providers', providers.length],
      ['videos', providers.reduce((sum, provider) => sum + provider.videos.length, 0)],
      ['framesPerVideo', VIDEO_FRAME_COUNT],
      ['judgeModel', judgeModel]
    ]),
    metadata: {
      runDir,
      providerCount: providers.length,
      videoCount: providers.reduce((sum, provider) => sum + provider.videos.length, 0),
      framesPerVideo: VIDEO_FRAME_COUNT,
      judgeModel
    }
  })

  const { report, jsonOut, markdownOut } = await writeVideoQualityReports(runDir, runJson, providers, judgeModel)
  const comparison = await writeProviderComparisonReports(runDir, report)

  l.write('info', 'Video Benchmark Report', {
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

  l.write('info', 'Video Quality Rankings', {
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
