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
  | 'imageAspectRatio'
  | 'imageSize'
  | 'imageQuality'
  | 'imageFormat'
  | 'imageBackground'
  | 'imagenCount'
>

export type ImageResult = {
  imagePaths: string[]
  metadata: Step5Metadata
}

export type ImageTarget = ProviderTargetBase<ImageProvider> & {
  run: (prompt: string, outputDir: string, opts: ImageGenOptions) => Promise<ImageResult>
}

export type ImageCostEstimate = CostEstimateBase<'gemini' | 'openai' | 'minimax'> & {
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
  imagenCount?: number | undefined
}
