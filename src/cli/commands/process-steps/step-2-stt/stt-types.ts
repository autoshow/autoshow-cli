import type {
  BatchChildRunContext,
  BatchProcessResult,
  DeepgramResponse,
  DiarizationOptions,
  GladiaStatusResponse,
  ProcessingOptions,
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
import type { SttBatchCoordinator } from './stt-batch/stt-batch-coordinator'

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
  retryable: boolean
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

export type SttProviderState = {
  service: SttTarget['service']
  model: string
  local: boolean
  artifactDir: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  retryable?: boolean | undefined
  lastError?: SttRecordedProviderError | undefined
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
  retryableOnly?: boolean | undefined
  maxPasses?: number | undefined
  ignoreUnresumableEntries?: boolean | undefined
}

export type NormalizedResumeSttBatchRunOptions = {
  retryableOnly: boolean
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

export type ProviderStats = {
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

export type AsyncSttPollMode = 'fresh' | 'resume-probe'

export type AsyncSttLifecycleHooks = {
  onJobReady?: ((runtime: Step2RuntimeMetadata) => Promise<void> | void) | undefined
  withPollSlot?: (<T>(fn: () => Promise<T>) => Promise<T>) | undefined
}

export type SttTargetOptions = {
  split?: boolean | undefined
  reverbVerbatimicity?: number | undefined
  sttSegmentConcurrency?: number | undefined
  audioDurationSeconds?: number | undefined
  runMode?: 'initial' | 'backfill' | undefined
  asyncLifecycle?: AsyncSttLifecycleHooks | undefined
}

export type IndexedTranscriptionChunk = {
  segmentIndex: number
  data: { result: TranscriptionResult, metadata: Step2Metadata }
}

export type TokenizedWord = {
  text: string
  normalized: string
}

export type AsyncSttPollLoopOptions<TStatus> = {
  jobId: string
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  audioDurationSeconds?: number | undefined
  envSpecificDeadlineKey: string
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

export type GladiaNormalizedWord = {
  start: number
  end: number
  text: string
  speaker?: string | undefined
  confidence?: number | undefined
}

export type GladiaResult = NonNullable<GladiaStatusResponse['result']>
export type GladiaTranscription = NonNullable<GladiaResult['transcription']>
export type GladiaUtterance = NonNullable<GladiaTranscription['utterances']>[number]
