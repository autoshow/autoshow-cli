import type { ProcessingOptions, Step5Metadata } from '~/types/process-types'
import type { ImageProvider } from '~/types/provider-types'

export type ImageGenOptions = Pick<
  ProcessingOptions,
  | 'geminiImageModel'
  | 'openaiImageModel'
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

export type ImageTarget = {
  service: ImageProvider
  model: string
  run: (prompt: string, outputDir: string, opts: ImageGenOptions) => Promise<ImageResult>
}
