import type { ExtractStepEstimate, ResolvedStep2Execution, RuntimeOptions } from '~/types'
import {
  GEMINI_OCR_PRICE_NOTE,
  GLM_OCR_PRICE_NOTE,
  estimateAnthropicOcrCost,
  estimateDeepinfraOcrCost,
  estimateGeminiOcrCost,
  estimateGlmOcrCost,
  estimateGrokOcrCost,
  estimateKimiOcrCost,
  estimateMistralOcrCost,
  estimateOpenAIOcrCost,
  estimateUnstructuredOcrCost
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

type LocalOcrService = 'tesseract' | 'ocrmypdf' | 'paddle-ocr'
type HostedOcrService = 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | 'grok' | 'unstructured'

type OcrCostEstimate = {
  provider: ExtractStepEstimate['provider']
  model: string
  totalCost: number
  costPer1kPagesCents?: number | undefined
  inputCostPer1MCents?: number | undefined
  outputCostPer1MCents?: number | undefined
  pageCount?: number | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  estimateType?: ExtractStepEstimate['estimateType'] | undefined
  note?: string | undefined
}

type HostedOcrEstimateHandler = {
  estimate: (model: string, input: string) => Promise<OcrCostEstimate>
  note?: string | ((estimate: OcrCostEstimate) => string | undefined) | undefined
  estimateType?: ExtractStepEstimate['estimateType'] | undefined
}

const LOCAL_OCR_NOTES = {
  tesseract: 'Local Tesseract OCR runs on local CPU and is not billed by AutoShow.',
  ocrmypdf: 'Local OCRmyPDF runs on local CPU and is not billed by AutoShow.',
  'paddle-ocr': 'Local PaddleOCR runs on local CPU/GPU and is not billed by AutoShow.'
} as const satisfies Record<LocalOcrService, string>

const HOSTED_OCR_HANDLERS = {
  mistral: {
    estimate: estimateMistralOcrCost,
    estimateType: 'exact'
  },
  glm: {
    estimate: estimateGlmOcrCost,
    note: GLM_OCR_PRICE_NOTE
  },
  kimi: {
    estimate: estimateKimiOcrCost,
    note: (estimate) => estimate.note
  },
  openai: {
    estimate: estimateOpenAIOcrCost,
    note: (estimate) => estimate.note
  },
  anthropic: {
    estimate: estimateAnthropicOcrCost,
    note: (estimate) => estimate.note
  },
  gemini: {
    estimate: estimateGeminiOcrCost,
    note: GEMINI_OCR_PRICE_NOTE
  },
  deepinfra: {
    estimate: estimateDeepinfraOcrCost,
    note: (estimate) => estimate.note
  },
  grok: {
    estimate: estimateGrokOcrCost,
    note: (estimate) => estimate.note
  },
  unstructured: {
    estimate: estimateUnstructuredOcrCost,
    estimateType: 'exact'
  }
} as const satisfies Record<HostedOcrService, HostedOcrEstimateHandler>

const isLocalOcrService = (service: string): service is LocalOcrService =>
  service in LOCAL_OCR_NOTES

const isHostedOcrService = (service: string): service is HostedOcrService =>
  service in HOSTED_OCR_HANDLERS

const buildLocalExtractEstimate = (provider: LocalOcrService, model: string): ExtractStepEstimate => ({
  step: 'extract',
  provider,
  model,
  totalCost: 0,
  costMultiplier: 1,
  estimateType: 'exact',
  note: LOCAL_OCR_NOTES[provider]
})

const resolveHostedNote = (
  handler: HostedOcrEstimateHandler,
  estimate: OcrCostEstimate
): string | undefined => {
  if (typeof handler.note === 'function') {
    return handler.note(estimate)
  }
  return handler.note ?? estimate.note
}

const buildHostedExtractEstimate = (
  estimate: OcrCostEstimate,
  handler: HostedOcrEstimateHandler
): ExtractStepEstimate => {
  const estimation = getExtractEstimation(estimate.provider, estimate.model)
  const note = resolveHostedNote(handler, estimate)
  const estimateType = handler.estimateType ?? estimate.estimateType

  return {
    step: 'extract',
    provider: estimate.provider,
    model: estimate.model,
    ...(typeof estimate.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: estimate.costPer1kPagesCents } : {}),
    ...(typeof estimate.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: estimate.inputCostPer1MCents } : {}),
    ...(typeof estimate.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: estimate.outputCostPer1MCents } : {}),
    ...(typeof estimate.pageCount === 'number' ? { pageCount: estimate.pageCount } : {}),
    ...(typeof estimate.promptTokens === 'number' ? { promptTokens: estimate.promptTokens } : {}),
    ...(typeof estimate.completionTokens === 'number' ? { completionTokens: estimate.completionTokens } : {}),
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    ...(estimateType ? { estimateType } : {}),
    ...(note ? { note } : {})
  }
}

export const buildExtractEstimates = async (
  resolvedTarget: string,
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'ocr' }>,
  _opts: RuntimeOptions
): Promise<ExtractStepEstimate[]> => {
  const estimates: ExtractStepEstimate[] = []

  for (const provider of resolvedStep2.providers) {
    if (isLocalOcrService(provider.service)) {
      estimates.push(buildLocalExtractEstimate(provider.service, provider.model))
      continue
    }

    if (isHostedOcrService(provider.service)) {
      const handler = HOSTED_OCR_HANDLERS[provider.service]
      const estimate = await handler.estimate(provider.model, resolvedTarget)
      estimates.push(buildHostedExtractEstimate(estimate, handler))
      continue
    }
  }

  return estimates
}
