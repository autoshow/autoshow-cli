import type {
  ExtractionOptions,
  HostedExtractOcrEngine,
  LocalExtractOcrEngine
} from '~/types'
import * as l from '~/utils/logger'

export const resolveExtractEngine = (opts: ExtractionOptions): LocalExtractOcrEngine => {
  if (opts.useOcrmypdf === true) return 'ocrmypdf'
  if (opts.usePaddleOcr === true) return 'paddle-ocr'
  return 'tesseract'
}

export const hasMistralOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.mistralOcrModel === 'string' && opts.mistralOcrModel.length > 0

export const hasGlmOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.glmOcrModel === 'string' && opts.glmOcrModel.length > 0

export const hasKimiOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.kimiOcrModel === 'string' && opts.kimiOcrModel.length > 0

export const hasOpenAIOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.openaiOcrModel === 'string' && opts.openaiOcrModel.length > 0

export const hasAnthropicOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.anthropicOcrModel === 'string' && opts.anthropicOcrModel.length > 0

export const hasGeminiOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.geminiOcrModel === 'string' && opts.geminiOcrModel.length > 0

export const hasDeepinfraOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.deepinfraOcrModel === 'string' && opts.deepinfraOcrModel.length > 0

export const hasAwsTextract = (opts: ExtractionOptions): boolean =>
  typeof opts.awsTextractModel === 'string' && opts.awsTextractModel.length > 0

export const hasGcloudDocai = (opts: ExtractionOptions): boolean =>
  typeof opts.gcloudDocaiModel === 'string' && opts.gcloudDocaiModel.length > 0

export const hasHostedOcr = (opts: ExtractionOptions): boolean =>
  hasMistralOcr(opts)
  || hasGlmOcr(opts)
  || hasKimiOcr(opts)
  || hasOpenAIOcr(opts)
  || hasAnthropicOcr(opts)
  || hasGeminiOcr(opts)
  || hasDeepinfraOcr(opts)
  || hasAwsTextract(opts)
  || hasGcloudDocai(opts)

export const hasOcrFlag = (opts: ExtractionOptions): boolean =>
  opts.useTesseract === true || opts.useOcrmypdf === true || opts.usePaddleOcr === true || hasHostedOcr(opts)

export const hasEpubExportFlags = (opts: ExtractionOptions): boolean =>
  opts.epubChapterFiles === true || typeof opts.epubChunkLimitChars === 'number'

export const countSelectedOcrEngines = (opts: ExtractionOptions): number =>
  [
    opts.useOcrmypdf === true,
    opts.usePaddleOcr === true,
    hasMistralOcr(opts),
    hasGlmOcr(opts),
    hasKimiOcr(opts),
    hasOpenAIOcr(opts),
    hasAnthropicOcr(opts),
    hasGeminiOcr(opts),
    hasDeepinfraOcr(opts),
    hasAwsTextract(opts),
    hasGcloudDocai(opts)
  ].filter(Boolean).length

export const getHostedOcrEngine = (opts: ExtractionOptions): HostedExtractOcrEngine | undefined => {
  if (hasMistralOcr(opts)) return 'mistral-ocr'
  if (hasGlmOcr(opts)) return 'glm-ocr'
  if (hasKimiOcr(opts)) return 'kimi-ocr'
  if (hasOpenAIOcr(opts)) return 'openai-ocr'
  if (hasAnthropicOcr(opts)) return 'anthropic-ocr'
  if (hasGeminiOcr(opts)) return 'gemini-ocr'
  if (hasDeepinfraOcr(opts)) return 'deepinfra-ocr'
  if (hasAwsTextract(opts)) return 'aws-textract'
  if (hasGcloudDocai(opts)) return 'gcloud-docai'
  return undefined
}

export const engineSuffix = (engine: LocalExtractOcrEngine): string => {
  switch (engine) {
    case 'tesseract':
      return 'tesseract'
    case 'ocrmypdf':
      return 'ocrmypdf'
    case 'paddle-ocr':
      return 'paddle-ocr'
  }
}

export const warnTesseractOnlyFlags = (
  engine: Exclude<LocalExtractOcrEngine, 'tesseract'>,
  opts: ExtractionOptions
): void => {
  if (opts.psm !== 3) {
    l.warn(`Flag --psm is Tesseract-specific and has no effect with the ${engine} engine`)
  }
  if (opts.oem !== 1) {
    l.warn(`Flag --oem is Tesseract-specific and has no effect with the ${engine} engine`)
  }
  if (opts.preserveInterwordSpaces === true) {
    l.warn(`Flag --preserve-spaces is Tesseract-specific and has no effect with the ${engine} engine`)
  }
}

export const warnHostedOnlyFlags = (
  engineName: HostedExtractOcrEngine,
  opts: ExtractionOptions
): void => {
  if (opts.psm !== 3) {
    l.warn(`Flag --psm is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
  if (opts.oem !== 1) {
    l.warn(`Flag --oem is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
  if (opts.preserveInterwordSpaces === true) {
    l.warn(`Flag --preserve-spaces is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
}
