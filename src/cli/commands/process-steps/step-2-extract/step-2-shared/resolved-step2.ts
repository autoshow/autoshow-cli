import { classifyOcrSourceKind } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/normalize'
import { collectStep2ProviderSelections } from './provider-registry'
import type {
  DetectResult,
  HtmlArticleBackend,
  OcrStep2ResolutionOptions,
  ResolvedStep2Execution,
  ResolvedStep2Provider,
  SttStep2ResolutionOptions
} from '~/types'

const DEFAULT_TESSERACT_PROVIDER: ResolvedStep2Provider = {
  service: 'tesseract',
  model: 'tesseract',
  origin: 'default'
}

const toResolvedProvider = (
  selection: ReturnType<typeof collectStep2ProviderSelections>[number]
): ResolvedStep2Provider => ({
  service: selection.targetService,
  model: selection.model,
  origin: selection.origin
})

const hasPreparedMarkdown = (
  value: string | undefined
): boolean => typeof value === 'string' && value.trim().length > 0

const resolveArticleBackend = (
  options: Pick<OcrStep2ResolutionOptions, 'localHtmlDocument' | 'urlBackend'>
): HtmlArticleBackend =>
  options.localHtmlDocument === true ? 'defuddle' : (options.urlBackend ?? 'defuddle')

const resolveOcrProviders = (
  options: OcrStep2ResolutionOptions
): ResolvedStep2Provider[] =>
  collectStep2ProviderSelections('ocr', options as Record<string, unknown>).map(toResolvedProvider)

export const resolveSttStep2Execution = (
  options: SttStep2ResolutionOptions
): ResolvedStep2Execution => {
  const providers = collectStep2ProviderSelections('stt', options as Record<string, unknown>).map(toResolvedProvider)
  if (providers.length > 0) {
    return {
      route: 'stt',
      sourceKind: 'media',
      providers
    }
  }

  return {
    route: 'stt',
    sourceKind: 'media',
    providers: [{
      service: 'whisper',
      model: typeof options.whisperModel === 'string' && options.whisperModel.length > 0 ? options.whisperModel : 'tiny',
      origin: 'default'
    }]
  }
}

export const resolveOcrStep2ExecutionFromFormat = (
  format: DetectResult | undefined,
  options: OcrStep2ResolutionOptions
): ResolvedStep2Execution => {
  if (hasPreparedMarkdown(options.preparedMarkdown) || format === 'html') {
    return {
      route: 'article',
      sourceKind: 'article',
      backend: resolveArticleBackend(options)
    }
  }

  if (!format) {
    return {
      route: 'unsupported',
      sourceKind: 'unsupported'
    }
  }

  if (format === 'csv') {
    return {
      route: 'native-document',
      sourceKind: 'csv'
    }
  }

  const providers = resolveOcrProviders(options)
  const ocrSourceKind = classifyOcrSourceKind(
    { format },
    {
      preparedMarkdown: options.preparedMarkdown,
      epubInspect: format === 'epub' && (options.useEpubBun === true || options.useEpubCalibre === true),
      forceOcr: providers.length > 0
    }
  )

  switch (ocrSourceKind) {
    case 'article':
      return {
        route: 'article',
        sourceKind: 'article',
        backend: resolveArticleBackend(options)
      }
    case 'epub-inspect':
      return {
        route: 'native-document',
        sourceKind: 'epub-inspect'
      }
    case 'office-native':
      return {
        route: 'native-document',
        sourceKind: format === 'epub' ? 'epub' : 'office'
      }
    case 'rtf-native':
      return {
        route: 'native-document',
        sourceKind: 'rtf'
      }
    case 'pdf':
      return {
        route: 'ocr',
        sourceKind: 'pdf',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'image':
      return {
        route: 'ocr',
        sourceKind: 'image',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'epub-pdf':
      return {
        route: 'ocr',
        sourceKind: 'epub-pdf',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
    case 'cbz-images':
      return {
        route: 'ocr',
        sourceKind: 'cbz-images',
        providers: providers.length > 0 ? providers : [DEFAULT_TESSERACT_PROVIDER]
      }
  }
}
