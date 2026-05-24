import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type DocumentMetadata,
  type EpubArtifactFile,
  type ExtractionMetadata,
  type ExtractionOptions,
  type ExtractionResult,
  type HostedOcrRun,
  type PageResult
} from '~/types'
import { estimateTokens } from '~/utils/text-utils'
import { validateData } from '~/utils/validate/validation'
import { buildCombinedText } from './native-text-extractors'

export type OcrResultBuilderInput = {
  start: number
  pages: PageResult[]
  extractionMethod: string
  step1Metadata: DocumentMetadata
  opts: ExtractionOptions
  epubPayload: Record<string, unknown> | undefined
  inputFamily: string | undefined
  normalizedFrom: string | undefined
  conversionChain: string[] | undefined
  outputFidelity: string | undefined
  canonicalText: string | undefined
  reportedTotalPages: number | undefined
  ocrService: string | undefined
  promptTokens: number | undefined
  completionTokens: number | undefined
  providerCostCents: number | undefined
  providerCostSource: HostedOcrRun['providerCostSource'] | undefined
  ocrProviderUsage: HostedOcrRun['providerUsage'] | undefined
  chapterExportSummary: Record<string, unknown> | undefined
  pdfChapterDetectionSummary: Record<string, unknown> | undefined
  artifactFiles: EpubArtifactFile[] | undefined
}

export const buildOcrOutput = (
  input: OcrResultBuilderInput
): { result: ExtractionResult, step2Metadata: ExtractionMetadata, artifactFiles?: EpubArtifactFile[] } => {
  const text = input.opts.preparedMarkdown
    ? input.opts.preparedMarkdown.trim()
    : typeof input.canonicalText === 'string' && input.canonicalText.trim().length > 0
      ? input.canonicalText.trim()
      : buildCombinedText(input.pages, input.extractionMethod !== 'epub-text')
  const ocrPages = input.pages.filter(page => page.method === 'ocr').length
  const textPages = input.pages.filter(page => page.method === 'text').length

  const totalPages = typeof input.reportedTotalPages === 'number'
    ? input.reportedTotalPages
    : input.pages.length > 0
      ? input.pages.length
      : input.step1Metadata.pageCount
  const localProcessingTime = Date.now() - input.start
  const processingTime = typeof input.opts.preparedMarkdown === 'string'
    && input.opts.preparedMarkdown.trim().length > 0
    && typeof input.opts.htmlArticleProcessingTimeMs === 'number'
    ? input.opts.htmlArticleProcessingTimeMs + localProcessingTime
    : localProcessingTime

  const result = validateData(ExtractionResultSchema, {
    text,
    pages: input.pages,
    totalPages,
    ocrPages,
    textPages
  }, 'extraction result')

  const step2MetadataPayload: Record<string, unknown> = {
    extractionMethod: input.extractionMethod,
    totalPages,
    ocrPages,
    textPages,
    processingTime,
    dpi: input.opts.dpi,
    languages: input.opts.languages,
    tokenEstimate: estimateTokens(result.text)
  }

  if (typeof input.ocrService === 'string') {
    step2MetadataPayload['ocrService'] = input.ocrService
  }
  if (typeof input.opts.mistralOcrModel === 'string' && input.extractionMethod.includes('mistral-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.mistralOcrModel
  }
  if (typeof input.opts.glmOcrModel === 'string' && input.extractionMethod.includes('glm-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.glmOcrModel
  }
  if (typeof input.opts.kimiOcrModel === 'string' && input.extractionMethod.includes('kimi-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.kimiOcrModel
  }
  if (typeof input.opts.openaiOcrModel === 'string' && input.extractionMethod.includes('openai-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.openaiOcrModel
  }
  if (typeof input.opts.grokOcrModel === 'string' && input.extractionMethod.includes('grok-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.grokOcrModel
  }
  if (typeof input.opts.anthropicOcrModel === 'string' && input.extractionMethod.includes('anthropic-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.anthropicOcrModel
  }
  if (typeof input.opts.geminiOcrModel === 'string' && input.extractionMethod.includes('gemini-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.geminiOcrModel
  }
  if (typeof input.opts.deepinfraOcrModel === 'string' && input.extractionMethod.includes('deepinfra-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.deepinfraOcrModel
  }
  if (typeof input.opts.unstructuredOcrModel === 'string' && input.extractionMethod.includes('unstructured-ocr')) {
    step2MetadataPayload['ocrModel'] = input.opts.unstructuredOcrModel
  }
  if (typeof input.providerCostCents === 'number') {
    step2MetadataPayload['providerCostCents'] = input.providerCostCents
  }
  if (input.providerCostSource) {
    step2MetadataPayload['providerCostSource'] = input.providerCostSource
  }
  if (input.ocrProviderUsage && input.ocrProviderUsage.length > 0) {
    step2MetadataPayload['ocrProviderUsage'] = input.ocrProviderUsage
  }
  if (typeof input.promptTokens === 'number') {
    step2MetadataPayload['promptTokens'] = input.promptTokens
  }
  if (typeof input.completionTokens === 'number') {
    step2MetadataPayload['completionTokens'] = input.completionTokens
  }
  if (input.epubPayload) step2MetadataPayload['epub'] = input.epubPayload
  if (input.chapterExportSummary) step2MetadataPayload['chapterExport'] = input.chapterExportSummary
  if (input.chapterExportSummary?.['sourceFormat'] === 'epub') step2MetadataPayload['epubExport'] = input.chapterExportSummary
  if (input.pdfChapterDetectionSummary) step2MetadataPayload['pdfChapterDetection'] = input.pdfChapterDetectionSummary
  if (input.inputFamily) step2MetadataPayload['inputFamily'] = input.inputFamily
  if (input.normalizedFrom) step2MetadataPayload['normalizedFrom'] = input.normalizedFrom
  if (input.conversionChain) step2MetadataPayload['conversionChain'] = input.conversionChain
  if (input.outputFidelity) step2MetadataPayload['outputFidelity'] = input.outputFidelity
  if (input.outputFidelity) step2MetadataPayload['outputFormat'] = input.opts.outputFormat

  const step2Metadata = validateData(ExtractionMetadataSchema, step2MetadataPayload, 'extraction metadata')

  return {
    result,
    step2Metadata,
    ...(input.artifactFiles ? { artifactFiles: input.artifactFiles } : {})
  }
}
