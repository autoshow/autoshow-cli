import type { OcrSelectionState } from '~/types'

export const HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING = 'OCR flags are ignored for HTML/article inputs.'
export const CSV_OCR_FLAGS_IGNORED_WARNING = 'OCR flags are ignored for CSV inputs (CSV content is read as raw text).'
export const CHAPTER_EXPORT_FLAGS_IGNORED_WARNING = 'Chapter export flags (--chapters, --length) are ignored for inputs other than EPUB and PDF.'
export const PDF_LENGTH_WITHOUT_CHAPTERS_WARNING = 'For PDF inputs, --length is only applied when --chapters is also set.'
export const EPUB_EXPORT_FLAGS_IGNORED_INSPECT_WARNING = 'EPUB export flags (--chapters, --length) are ignored when using EPUB inspect mode.'
export const EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING = 'EPUB export flags (--chapters, --length) are ignored when an OCR engine is selected for EPUB input.'
export const EPUB_INSPECT_NON_EPUB_INFO = 'EPUB inspect flag was provided for a non-EPUB input. Falling back to normal extract flow for this file.'
export const EPUB_INSPECT_JSON_ONLY_ERROR = 'EPUB inspect mode supports JSON output only. Use --out json with --epub-bun or --epub-calibre.'

const hasSelectedModel = (
  values: string[] | undefined,
  value: string | undefined
): boolean => (values?.length ?? 0) > 0 || (typeof value === 'string' && value.length > 0)

export const hasConfiguredOcrProviderSelection = (
  opts: OcrSelectionState
): boolean =>
  opts.useTesseract === true
  || opts.useOcrmypdf === true
  || opts.usePaddleOcr === true
  || hasSelectedModel(opts.mistralOcrModels, opts.mistralOcrModel)
  || hasSelectedModel(opts.glmOcrModels, opts.glmOcrModel)
  || hasSelectedModel(opts.openaiOcrModels, opts.openaiOcrModel)
  || hasSelectedModel(opts.anthropicOcrModels, opts.anthropicOcrModel)
  || hasSelectedModel(opts.geminiOcrModels, opts.geminiOcrModel)
  || hasSelectedModel(opts.awsTextractModels, opts.awsTextractModel)
  || hasSelectedModel(opts.gcloudDocaiModels, opts.gcloudDocaiModel)
  || hasSelectedModel(opts.deapiOcrModels, opts.deapiOcrModel)

export const formatHtmlArticleOcrFlagsIgnoredWarning = (
  target?: string
): string =>
  target && target.length > 0
    ? `${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)}: ${target}`
    : HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING

export const buildSpeakerCountHintWarning = <T,>(
  targets: T[],
  requestedSpeakerCount: number | undefined,
  supportsSpeakerCountHint: (target: T) => boolean,
  formatTargetLabel: (target: T) => string
): string | undefined => {
  if (requestedSpeakerCount === undefined || targets.length === 0) {
    return undefined
  }

  const honored = targets
    .filter((target) => supportsSpeakerCountHint(target))
    .map(formatTargetLabel)
  const ignored = targets
    .filter((target) => !supportsSpeakerCountHint(target))
    .map(formatTargetLabel)

  if (ignored.length === 0) {
    return undefined
  }

  return [
    `Using --speaker-count=${requestedSpeakerCount} for STT diarization`,
    `honored=${honored.length > 0 ? honored.join(', ') : 'none'}`,
    `ignored=${ignored.join(', ')}`
  ].join('; ')
}
