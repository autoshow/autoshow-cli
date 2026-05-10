import type {
  CostEstimateBase,
  ImageProvider,
  ProcessingOptions,
  ProviderTargetBase,
  Step5Metadata
} from '~/types'

export type ImageGenOptions = Pick<
  ProcessingOptions,
  | 'geminiImageModels'
  | 'geminiImageModel'
  | 'openaiImageModels'
  | 'openaiImageModel'
  | 'minimaxImageModels'
  | 'minimaxImageModel'
  | 'glmImageModels'
  | 'glmImageModel'
  | 'grokImageModels'
  | 'grokImageModel'
  | 'runwayImageModels'
  | 'runwayImageModel'
  | 'bflImageModels'
  | 'bflImageModel'
  | 'deapiImageModels'
  | 'deapiImageModel'
  | 'imageAspectRatio'
  | 'imageSize'
  | 'imageQuality'
  | 'imageFormat'
  | 'imageBackground'
  | 'imagenCount'
  | 'imageProviderConcurrency'
  | 'imageLocalConcurrency'
>

export type ImageResult = {
  imagePaths: string[]
  metadata: Step5Metadata
}

export type ImageTarget = ProviderTargetBase<ImageProvider> & {
  run: (prompt: string, outputDir: string, opts: ImageGenOptions) => Promise<ImageResult>
}

export type ImageCostEstimate = CostEstimateBase<ImageProvider> & {
  imageCount: number
  costPerImageCents: number
}

export type EstimateImageCostOptions = {
  geminiImageModels?: string[] | undefined
  geminiImageModel?: string | undefined
  openaiImageModels?: string[] | undefined
  openaiImageModel?: string | undefined
  minimaxImageModels?: string[] | undefined
  minimaxImageModel?: string | undefined
  glmImageModels?: string[] | undefined
  glmImageModel?: string | undefined
  grokImageModels?: string[] | undefined
  grokImageModel?: string | undefined
  runwayImageModels?: string[] | undefined
  runwayImageModel?: string | undefined
  bflImageModels?: string[] | undefined
  bflImageModel?: string | undefined
  deapiImageModels?: string[] | undefined
  deapiImageModel?: string | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imagenCount?: number | undefined
}
