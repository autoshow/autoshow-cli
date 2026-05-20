import type {
  BatchManifest,
  HumanLogTable,
  InputFamily,
  RunManifest,
  RuntimeOptions,
  TimingStepEntry,
} from '~/types'

export type WriteStepKind = TimingStepEntry['step']

export type WriteManifestMetadata = Record<string, unknown>

export type WriteManifestSourceRefs = {
  promptArtifact?: string
  extractPromptSource?: string
  step3RenderedOutput?: string
}

export type WriteRunSummaryRow = {
  step: string
  providerModel: string
  predictedCostCents: number | null
  actualCostCents: number | null
  actualCostSource: string | null
  predictedTimeMs: number | null
  actualTimeMs: number | null
  predictedSpeed: string | null
  actualSpeed: string | null
  predictedInputMetric: string | null
  predictedInputValue: number | null
  actualInputMetric: string | null
  actualInputValue: number | null
}

export type WritePromptUsageRow = {
  step: string
  providerModel: string
  promptSource: string | null
  usage: string | null
}

export type OcrCostCalculationRow = {
  providerModel: string
  pages: number | null
  predictedInputs: string | null
  actualInputs: string | null
  rates: string | null
  predictedCostCents: number | null
  actualCostCents: number | null
  deltaCents: number | null
}

export type SummaryBaseRow = {
  stepKey: WriteStepKind
  step: string
  provider: string
  model: string
  providerModel: string
}

export type CostEntryLike = {
  step: WriteStepKind
  provider: string
  model: string
  cost: number
  costSource?: string
  inputMetric?: string
  inputValue?: number
}

export type TimingEntryLike = {
  step: WriteStepKind
  provider: string
  model: string
  processingTimeMs: number
  inputMetric?: string
  inputValue?: number
  throughputValue?: number
  throughputUnit?: TimingStepEntry['throughputUnit']
}

export type IndexedRow<T> = {
  key: string
  occurrence: number
  value: T
}

export type SummarySection = {
  columns: readonly string[]
  humanTable: HumanLogTable
  rows: WriteRunSummaryRow[]
}

export type PromptUsageSection = {
  columns: readonly string[]
  humanTable: HumanLogTable
  rows: WritePromptUsageRow[]
}

export type OcrCostCalculationSection = {
  columns: readonly string[]
  humanTable: HumanLogTable
  rows: OcrCostCalculationRow[]
}

export type WriteManifestConsoleSummary = {
  runSummary?: SummarySection
  promptUsage?: PromptUsageSection
  ocrCostCalculation?: OcrCostCalculationSection
}

export type TargetBase = {
  service: string
  model: string
}

export type TargetPoolKind = 'hosted' | 'local'

export type TargetSchedulerConcurrency = {
  provider: number
  local: number
}

export type SingleFileArtifactNameOptions = {
  singleFileName: string
  multiFilePrefix: string
  extension: string
}

export type BuildSingleArtifactMapOptions<T> = {
  singleKey: string
  multiKeyPrefix: string
  getService: (item: T) => string
  getModel: (item: T) => string
  getFileName: (item: T) => string
}

export type SingleFileRunResult<TMetadata> = {
  filePath: string
  metadata: TMetadata
}

export type RunSingleFileTargetsOptions<TTarget extends TargetBase, TMetadata> = {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  workspacePrefix: string
  concurrency?: TargetSchedulerConcurrency | undefined
  getTargetPool?: ((target: TTarget) => TargetPoolKind) | undefined
  getTargetPriority?: ((target: TTarget, index: number) => number | undefined) | undefined
  runTarget: (target: TTarget, workspaceDir: string) => Promise<SingleFileRunResult<TMetadata>>
  getArtifactFileName: (target: TTarget, singleTarget: boolean) => string
  finalizeMetadata: (metadata: TMetadata, finalFileName: string, finalPath: string) => TMetadata
}

export type RunTargetsOptions<TTarget extends TargetBase, TResult> = {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  concurrency?: TargetSchedulerConcurrency | undefined
  getTargetPool?: ((target: TTarget) => TargetPoolKind) | undefined
  getTargetPriority?: ((target: TTarget, index: number) => number | undefined) | undefined
  getWorkspaceDir: (outputDir: string, target: TTarget) => string
  runTarget: (target: TTarget, workspaceDir: string) => Promise<TResult>
  finalizeTarget: (target: TTarget, result: TResult, singleTarget: boolean) => Promise<TResult>
}

export type SuitePriceSummary = {
  checkedLabel: string
  checkedCount: number
  totalEstimatedCost: number
}

export type ProcessVideoRuntimeOptions = Pick<RuntimeOptions, 'outputRootDir' | 'sttProviderConcurrency' | 'sttLocalConcurrency' | 'sttSegmentConcurrency'>
  & { outputDir?: string | undefined }

export type ProcessCommandCapabilities = {
  supportsBatchSourceExpansion: boolean
  supportedInputFamilies?: readonly InputFamily[] | undefined
}

export type RunManifestKind = RunManifest['kind']
export type BatchManifestKind = BatchManifest['kind']

export type CostStep = {
  step: string
  cost: number
}

export type MediaGenerationStatus = {
  mediaType: 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  status: string
  processingTimeMs?: number
  outputCount?: number
  detail?: string
}

export type BatchChildDirectoryIdentity = {
  slug?: string | undefined
  title?: string | undefined
  publishedAt?: string | undefined
  fallbackLabel?: string | undefined
}
