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
  | 'grokImageModels'
  | 'grokImageModel'
  | 'bflImageModels'
  | 'bflImageModel'
  | 'reveImageModels'
  | 'reveImageModel'
  | 'imageAspectRatio'
  | 'imageSize'
  | 'imageQuality'
  | 'imageFormat'
  | 'imageBackground'
  | 'imageCount'
  | 'imageInputs'
  | 'imageMask'
  | 'imageResponseMode'
  | 'geminiSearchGrounding'
  | 'imageCompression'
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
  grokImageModels?: string[] | undefined
  grokImageModel?: string | undefined
  bflImageModels?: string[] | undefined
  bflImageModel?: string | undefined
  reveImageModels?: string[] | undefined
  reveImageModel?: string | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageCount?: number | undefined
}
