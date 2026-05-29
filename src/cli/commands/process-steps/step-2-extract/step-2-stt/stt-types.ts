import type * as v from 'valibot'
import type {
  BatchChildRunContext,
  BatchProcessResult,
  DeepgramResponse,
  DiarizationOptions,
  GladiaStatusResponse,
  ProcessingOptions,
  RateEstimateBase,
  YtDlpVideoInfo,
  RetryClass,
  Step1Metadata,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscribeEngine,
  TranscriptionResult,
  VideoMetadata,
  BatchManifestEntry
} from '~/types'
import type { ElevenlabsSttModel } from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'
import type { ProviderRunStateBase } from '../step-2-shared/step-2-shared-types'
import { SttBatchCoordinator } from './stt-batch/stt-batch-coordinator'
import { MistralSttPassController } from './stt-services/mistral/mistral-stt-pass-controller'
import {
  ElevenLabsSttResponseSchema,
  RevJobSchema,
  RevTranscriptResponseSchema,
  SonioxTranscriptionStatusSchema,
  SonioxTranscriptResponseSchema,
  SpeechmaticsCreateJobResponseSchema,
  SpeechmaticsJobSchema,
  SpeechmaticsTranscriptResponseSchema,
  WhisperJsonOutputSchema
} from '~/types/process-types'

export { SttBatchCoordinator } from './stt-batch/stt-batch-coordinator'

export type TranscribeEngineCapabilities = {
  diarizationByDefault: boolean
  supportsSpeakerCountHint: boolean
}

export type SttBatchSummaryItem = {
  url?: string | undefined
  title?: string | undefined
  publishedAt?: string | undefined
  outputDir: string
  completionStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  transcriptionService?: string | undefined
  transcriptionModel?: string | undefined
  captionUsed: boolean
  captionKind?: 'manual' | 'auto' | undefined
  captionLanguage?: string | undefined
}

export type EmbeddedJson = {
  text?: string
  segments?: Array<{
    start?: number
    end?: number
    text?: string
    speaker?: string
  }>
}

export type OpenAICompatibleTranscriptionSegment = {
  start?: unknown
  end?: unknown
  text?: unknown
}

export type OpenAICompatibleTranscriptionResponse = {
  text?: unknown
  segments?: unknown
}

export type WhisperJsonOutput = v.InferOutput<typeof WhisperJsonOutputSchema>
export type ElevenLabsSttResponse = v.InferOutput<typeof ElevenLabsSttResponseSchema>
export type SonioxTranscriptionStatus = v.InferOutput<typeof SonioxTranscriptionStatusSchema>
export type SonioxTranscriptResponse = v.InferOutput<typeof SonioxTranscriptResponseSchema>
export type RevJob = v.InferOutput<typeof RevJobSchema>
export type RevTranscriptResponse = v.InferOutput<typeof RevTranscriptResponseSchema>
export type SpeechmaticsCreateJobResponse = v.InferOutput<typeof SpeechmaticsCreateJobResponseSchema>
export type SpeechmaticsJob = v.InferOutput<typeof SpeechmaticsJobSchema>
export type SpeechmaticsTranscriptResponse = v.InferOutput<typeof SpeechmaticsTranscriptResponseSchema>

export type Step2TimingMetadata = {
  queueWaitMs?: number | undefined
  transcribeMs?: number | undefined
  uploadMs?: number | undefined
  createMs?: number | undefined
  createCount?: number | undefined
  pollMs?: number | undefined
  pollSleepMs?: number | undefined
  pollCount?: number | undefined
  transcriptMs?: number | undefined
  remoteProcessingMs?: number | undefined
  cleanupMs?: number | undefined
  requestCount?: number | undefined
  retryCount?: number | undefined
  rateLimitCount?: number | undefined
  blockedCount?: number | undefined
  degradedCount?: number | undefined
  backfillCount?: number | undefined
}

export type ElevenlabsSttRateEstimate = RateEstimateBase<'elevenlabs', ElevenlabsSttModel> & {
  costPerHourCents: number
  costPerMinuteCents: number
}

export type SttTarget = {
  service: TranscribeEngine
  model: string
  local: boolean
  diarizationOptions?: DiarizationOptions | undefined
}

export type ProviderFailure = SttProviderFailureSummary & {
  index: number
  service: SttTarget['service']
  model: string
}

export type ProcessSttRunOptions = {
  outputDir?: string | undefined
  requestedTargets?: SttTarget[] | undefined
  targetsToRun?: SttTarget[] | undefined
  batchCoordinator?: SttBatchCoordinator | undefined
  mistralPassController?: MistralSttPassController | undefined
  batchChildContext?: BatchChildRunContext | undefined
}

export type PromptSelectionCandidate = SttProviderSuccess

export type ProviderErrorLike = Error & {
  cause?: unknown
  headers?: Headers
  retryClass?: RetryClass
  stage?: string
  status?: number
  retryable?: boolean
  skipped?: boolean
  rawResponse?: unknown
}

export type EffectiveSttProviderConcurrency = {
  requested: number
  effective: number
  hostedProviderCount: number
}

export type CacheArtifactStatus = 'hit' | 'miss'

export type CacheArtifactRecord = {
  fileName: string
  size: number
  profile?: 'default' | 'hosted-stt' | 'hosted-stt-mp3' | undefined
}

export type MediaCacheEntry = {
  cacheKey: string
  weakFingerprint?: boolean | undefined
  metadataSchemaVersion: number
  artifactVersions: {
    source_media: number
  }
  durationSeconds?: number | undefined
  createdAt: string
  lastAccessedAt: string
  artifacts?: {
    source_media?: CacheArtifactRecord | undefined
  } | undefined
}

export type CacheLookup = {
  cacheKey: string
  weakFingerprint: boolean
  metadata: VideoMetadata
  sourceVideoInfo?: YtDlpVideoInfo | undefined
}

export type AcquireArtifactOptions = {
  source: { url?: string, filePath?: string }
  targets: SttTarget[]
  outputDir?: string | undefined
  noCache?: boolean | undefined
  refreshCache?: boolean | undefined
}

export type PreparedSttMedia = {
  metadata: VideoMetadata
  sourceVideoInfo?: YtDlpVideoInfo | undefined
  step1Metadata: Step1Metadata
  durationSeconds: number
  executionArtifacts: {
    sourceMediaPath: string
  }
  outputArtifacts: {
    sourceMediaPath: string
  }
  cache: {
    sourceMedia: CacheArtifactStatus
  }
  timings: {
    sourceMediaMs?: number | undefined
  }
  cleanup?: (() => Promise<void>) | undefined
}

export type SttCompletionStatus = 'full' | 'incomplete' | 'failed'

export type SttRequestedProvider = Pick<SttTarget, 'service' | 'model' | 'local' | 'diarizationOptions'>

export type SttRecordedProviderError = {
  message: string
  skipped?: boolean | undefined
  stage?: string | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
  errorFile?: string | undefined
  rawResponseFile?: string | undefined
}

export type SttProviderFailureSummary = {
  message: string
  retryable: boolean
  skipped?: boolean | undefined
  stage?: string | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
  errorFile?: string | undefined
  rawResponseFile?: string | undefined
}

export type SttProviderState = ProviderRunStateBase<SttTarget['service'], SttRecordedProviderError> & {
  local: boolean
}

export type SttProviderSuccess = {
  target: SttTarget
  metadata: Step2Metadata
  result: TranscriptionResult
  relativeDir?: string | undefined
}

export type ExistingSttRun = {
  successes: Array<SttProviderSuccess | undefined>
  providerStates: Map<string, SttProviderState>
}

export type ResumeBatchEntry = {
  outputDir: string
  source: { url?: string, filePath?: string }
  requestedTargets: SttTarget[]
  missingTargets: SttTarget[]
  completionStatus: SttCompletionStatus
  rawEntry: BatchManifestEntry
}

export type ResumeSttBatchRunOptions = {
  maxPasses?: number | undefined
  ignoreUnresumableEntries?: boolean | undefined
}

export type NormalizedResumeSttBatchRunOptions = {
  maxPasses: number
  ignoreUnresumableEntries: boolean
}

export type ResumeSttBatchPassResult = BatchProcessResult & {
  attemptedEntries: number
}

export type ResumeBatchManifest = {
  infoPath: string
  entries: BatchManifestEntry[]
}

export type SttBatchProviderProfile = {
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
}

export type SttProviderSlotSummary = {
  service: SttTarget['service']
  model: string
  provider: string
  kind: 'sync' | 'async'
  launchSlots: number
  pollSlots: number | null
}

export type SttBatchBlockedProviderReason = {
  service: SttTarget['service']
  model: string
  local: boolean
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
  degraded?: boolean | undefined
}

export type SttBatchAttemptDecision =
  | { action: 'run' }
  | { action: 'skip', reason: SttBatchBlockedProviderReason }
  | { action: 'defer' }

export type SttBatchProviderAvailability =
  | { action: 'run', activeCount: number, slotLimit: number }
  | { action: 'skip', reason: SttBatchBlockedProviderReason, activeCount: number, slotLimit: number }
  | { action: 'defer', activeCount: number, slotLimit: number, cooldownMs?: number | undefined }

export type SttBatchProviderStatsSnapshot = {
  service: SttTarget['service']
  model: string
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
  launchedCount: number
  completedCount: number
  blockedCount: number
  degradedCount: number
  queueWaitMs: number
  pollCount: number
  backfillCount: number
  warmupComplete: boolean
}

export type SttBatchSchedulerSnapshot = {
  providers: SttBatchProviderStatsSnapshot[]
}

export type AvailabilityWaiter = {
  resolved: boolean
  notify: () => void
  timer?: ReturnType<typeof setTimeout> | undefined
}

type ProviderStats = {
  launchedCount: number
  completedCount: number
  blockedCount: number
  degradedCount: number
  queueWaitMs: number
  pollCount: number
  backfillCount: number
}

export type ProviderState = {
  activeCount: number
  pollActiveCount: number
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: AvailabilityWaiter[]
  pollWaiters: AvailabilityWaiter[]
  cooldownUntil?: number | undefined
  warmupComplete: boolean
  consecutiveRetryableFailures: number
  stats: ProviderStats
}

export type ProviderFailureSummary = {
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
}

export type ProviderProfile = SttBatchProviderProfile

export type CoordinatedTargetSelection = {
  index: number
  queueWaitMs: number
}

export type WhisperProgressLogContext = {
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  segmentStartSeconds?: number | undefined
  segmentDurationSeconds?: number | undefined
  totalDurationSeconds?: number | undefined
}

export type PreparedLocalSttInput = {
  audioPath: string
  cleanup: () => Promise<void>
}

export type DiarizationFlagOptions = Pick<
  ProcessingOptions,
  'diarizationSpeakerCount'
>

export type WhisperProgressWindow = {
  segmentStartSeconds: number
  segmentDurationSeconds: number
  totalDurationSeconds: number
}

type AsyncSttPollMode = 'fresh' | 'resume-probe'

export type AsyncSttLifecycleHooks = {
  onJobReady?: ((runtime: Step2RuntimeMetadata) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
}

export type SttTargetOptions = {
  split?: boolean | undefined
  reverbVerbatimicity?: number | undefined
  sttSegmentConcurrency?: number | undefined
  audioDurationSeconds?: number | undefined
  sourceUrl?: string | undefined
  language?: string | undefined
  happyscribeOrganizationId?: string | undefined
  runMode?: 'initial' | 'backfill' | undefined
  asyncLifecycle?: AsyncSttLifecycleHooks | undefined
  mistralPassController?: MistralSttPassController | undefined
}

export type IndexedTranscriptionChunk = {
  segmentIndex: number
  data: { result: TranscriptionResult, metadata: Step2Metadata }
}

export type AsyncSttPollLoopOptions<TStatus> = {
  jobId: string
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  audioDurationSeconds?: number | undefined
  pollMode?: AsyncSttPollMode | undefined
  poll: () => Promise<{ status: TStatus, retryAfterMs: number | null }>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number) => never
  buildResumeProbeError?: ((jobId: string, probeCount: number, totalWaitMs: number) => never) | undefined
  onProgress?: ((status: TStatus) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
}

export type AudioSegmentDescriptor = {
  path: string
  segmentNumber: number
  totalSegments: number
  startSeconds: number
  durationSeconds: number
}

export type MistralHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'transcribe'
  retryClass?: RetryClass
}

export type SpeechmaticsHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'create' | 'poll' | 'transcript'
  retryClass?: RetryClass
  rawResponse?: unknown
}

export type RevHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'create' | 'poll' | 'transcript'
  retryClass?: RetryClass
  rawResponse?: unknown
}

export type ElevenLabsHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'transcribe'
  retryClass?: RetryClass
}

export type SonioxHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'upload' | 'create' | 'poll' | 'transcript'
  retryClass?: RetryClass
  rawResponse?: unknown
}

export type AssemblyAiHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'upload' | 'create' | 'poll'
  retryClass?: RetryClass
  rawResponse?: unknown
}

export type DeepgramHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'transcribe'
  retryClass?: RetryClass
}

export type DeepgramAlternative = NonNullable<DeepgramResponse['results']['channels'][number]['alternatives']>[number]
export type DeepgramWords = DeepgramAlternative['words']

export type GladiaHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'upload' | 'create' | 'poll'
  retryClass?: RetryClass
  rawResponse?: unknown
}

export type SupadataHttpError = Error & {
  status?: number
  headers?: Headers
  stage?: 'create' | 'poll'
  retryClass?: RetryClass
  retryable?: boolean
  skipped?: boolean
  rawResponse?: unknown
}

export type GladiaNormalizedWord = {
  start: number
  end: number
  text: string
  speaker?: string | undefined
  confidence?: number | undefined
}

type GladiaResult = NonNullable<GladiaStatusResponse['result']>
type GladiaTranscription = NonNullable<GladiaResult['transcription']>
export type GladiaUtterance = NonNullable<GladiaTranscription['utterances']>[number]

export type SplitPolicyTarget = Pick<SttTarget, 'service' | 'model'>

export type SttCacheEvent = {
  artifact: string
  status: 'hit' | 'miss' | 'rebuild' | 'bypass' | 'weak_fingerprint'
  key: string
  detail?: string
}

export type SttAcquireSummary = {
  item: string
  sourceMedia: string
  elapsedMs: number
}

export type SttAsyncJobLifecycle = {
  provider: string
  action: 'created' | 'resumed'
  remoteId: string
  state: string
}

export type SttSegmentLifecycle = {
  provider: string
  action: 'started' | 'completed'
  segmentNumber?: number
  totalSegments?: number
  model?: string
  processingTimeMs?: number
  detail?: string
}

export type SttRunStatusSummary = {
  completionStatus: SttCompletionStatus
  requested: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
}

export type SttProviderConcurrencySummary = {
  mode: 'batch_scheduler' | 'cloud_provider_concurrency'
  requested: number
  effective: number
  batchConcurrency: number
  hostedProviders: number
  providerSlots: string
}

export type HappyScribeOrganization = {
  id: string
  name?: string | undefined
  currency?: string | undefined
}

export type HappyScribeOrganizationSelection = {
  selected?: HappyScribeOrganization | undefined
  organizations: HappyScribeOrganization[]
  source?: 'option' | 'env' | 'auto' | undefined
  reason?: 'missing' | 'not_found' | 'ambiguous' | undefined
  requestedOrganizationId?: string | undefined
}

export type HappyScribeStage = 'upload' | 'create' | 'poll' | 'result'

export type HappyScribeHttpError = Error & {
  status?: number
  headers?: Headers
  stage?: HappyScribeStage
  retryClass?: RetryClass
  retryable?: boolean
  rawResponse?: unknown
}

type HappyScribeOrderState =
  | 'incomplete'
  | 'waiting_for_payment'
  | 'submitted'
  | 'locked'
  | 'fulfilled'
  | 'failed'
  | string

export type HappyScribeOrder = {
  id: string
  state: HappyScribeOrderState
  details?: {
    totalCents?: number | undefined
    totalCredits?: number | undefined
    currency?: string | undefined
  } | undefined
  outputsIds: string[]
  transcriptions: Array<{
    id?: string | undefined
    uuid?: string | undefined
    state?: string | undefined
  }>
}

export type HappyScribeTranscription = {
  id?: string | undefined
  state?: string | undefined
  failureReason?: string | undefined
  failureMessage?: string | undefined
  costInCents?: number | undefined
  downloadUrl?: string | undefined
}

export type HappyScribeExport = {
  id: string
  state: string
  downloadLink?: string | undefined
}

export type MistralAvailabilityWaiter = {
  resolved: boolean
  notify: () => void
}

export type SupadataChunk = {
  text: string
  offset: number
  duration: number
  lang?: string | undefined
}

export type SupadataTranscriptPayload = {
  content: string | SupadataChunk[]
  lang?: string | undefined
  availableLangs?: string[] | undefined
}

export type SupadataJobPayload = {
  jobId: string
}

export type SupadataJobStatus = {
  status: 'queued' | 'active' | 'completed' | 'failed'
  content?: string | SupadataChunk[] | undefined
  lang?: string | undefined
  availableLangs?: string[] | undefined
  error?: unknown
  message?: unknown
}

export type SttSplitPolicy = {
  attachmentCapBytes?: number | undefined
  maxDurationSeconds?: number | undefined
  requestBudgetSeconds?: number | undefined
  preferredSegmentDurationMinutes?: number | undefined
}

export type SttSplitDecisionReason =
  | { kind: 'explicit' }
  | { kind: 'attachment_cap', attachmentCapBytes: number, audioFileSizeBytes: number }
  | { kind: 'duration_cap', maxDurationSeconds: number, audioDurationSeconds: number }
  | { kind: 'request_budget', requestBudgetSeconds: number, audioDurationSeconds: number }

export type SttSplitDecision = {
  shouldSplit: boolean
  policy: SttSplitPolicy
  reasons: SttSplitDecisionReason[]
  segmentDurationMinutes: number
}

export type YoutubeCaptionTrack = NonNullable<YtDlpVideoInfo['subtitles']>[string][number]

export type YoutubeCaptionSelection = {
  kind: 'manual' | 'auto'
  language: string
  track: YoutubeCaptionTrack
}

export type ParsedYoutubeCue = {
  startSeconds: number
  endSeconds: number
  text: string
}

export type YoutubeCaptionMetadataFile = {
  captionKind: 'manual' | 'auto'
  captionLanguage: string
  sourceUrl: string
  trackName: string | null
  subtitleInventory: Record<string, Array<{ ext: string, name?: string }>>
  automaticCaptionInventory: Record<string, Array<{ ext: string, name?: string }>>
}
