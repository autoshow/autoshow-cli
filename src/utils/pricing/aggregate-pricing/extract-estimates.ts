import type { ExtractStepEstimate, ResolvedStep2Execution, RuntimeOptions } from '~/types'
import {
  estimateAnthropicOcrCost,
  estimateAwsTextractCost,
  estimateDeepinfraOcrCost,
  estimateDeapiOcrCost,
  estimateGcloudDocaiCost,
  estimateGeminiOcrCost,
  estimateGlmOcrCost,
  estimateKimiOcrCost,
  estimateMistralOcrCost,
  estimateOpenAIOcrCost
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

export const buildExtractEstimates = async (
  resolvedTarget: string,
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'ocr' }>,
  opts: RuntimeOptions
): Promise<ExtractStepEstimate[]> => {
  const estimates: ExtractStepEstimate[] = []

  for (const provider of resolvedStep2.providers) {
    if (provider.service === 'tesseract') {
      estimates.push({
        step: 'extract',
        provider: 'tesseract',
        model: provider.model,
        totalCost: 0,
        costMultiplier: 1,
        estimateType: 'exact',
        note: 'Local Tesseract OCR runs on local CPU and is not billed by AutoShow.'
      })
      continue
    }

    if (provider.service === 'ocrmypdf') {
      estimates.push({
        step: 'extract',
        provider: 'ocrmypdf',
        model: provider.model,
        totalCost: 0,
        costMultiplier: 1,
        estimateType: 'exact',
        note: 'Local OCRmyPDF runs on local CPU and is not billed by AutoShow.'
      })
      continue
    }

    if (provider.service === 'paddle-ocr') {
      estimates.push({
        step: 'extract',
        provider: 'paddle-ocr',
        model: provider.model,
        totalCost: 0,
        costMultiplier: 1,
        estimateType: 'exact',
        note: 'Local PaddleOCR runs on local CPU/GPU and is not billed by AutoShow.'
      })
      continue
    }

    if (provider.service === 'mistral') {
      const estimate = await estimateMistralOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        costPer1kPagesCents: estimate.costPer1kPagesCents,
        pageCount: estimate.pageCount,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: 'exact'
      })
      continue
    }

    if (provider.service === 'glm') {
      const estimate = await estimateGlmOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: 'Heuristic token estimate based on 4,000 total tokens per page.'
      })
      continue
    }

    if (provider.service === 'kimi') {
      const estimate = await estimateKimiOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      continue
    }

    if (provider.service === 'openai') {
      const estimate = await estimateOpenAIOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      continue
    }

    if (provider.service === 'anthropic') {
      const estimate = await estimateAnthropicOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      continue
    }

    if (provider.service === 'gemini') {
      const estimate = await estimateGeminiOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: 'Heuristic token estimate based on 4,000 total tokens per page.'
      })
      continue
    }

    if (provider.service === 'deepinfra') {
      const estimate = await estimateDeepinfraOcrCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        inputCostPer1MCents: estimate.inputCostPer1MCents,
        outputCostPer1MCents: estimate.outputCostPer1MCents,
        pageCount: estimate.pageCount,
        promptTokens: estimate.promptTokens,
        completionTokens: estimate.completionTokens,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      continue
    }

    if (provider.service === 'gcloud-docai') {
      const estimate = await estimateGcloudDocaiCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        costPer1kPagesCents: estimate.costPer1kPagesCents,
        pageCount: estimate.pageCount,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: 'exact'
      })
      continue
    }

    if (provider.service === 'aws-textract') {
      const estimate = await estimateAwsTextractCost(provider.model, resolvedTarget)
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        costPer1kPagesCents: estimate.costPer1kPagesCents,
        pageCount: estimate.pageCount,
        totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
        estimateType: 'exact'
      })
      continue
    }

    if (provider.service === 'deapi') {
      const estimate = await estimateDeapiOcrCost(provider.model, resolvedTarget, {
        dpi: opts.dpi,
        password: opts.password,
        rotate: opts.rotate,
        languages: opts.lang
      })
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      const totalCost = estimate.estimateType === 'exact'
        ? estimate.totalCost
        : applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
      estimates.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        pageCount: estimate.pageCount,
        costPer1kOutputCharsCents: estimate.costPer1kOutputCharsCents,
        ...(estimate.estimatedOutputChars !== undefined ? { estimatedOutputChars: estimate.estimatedOutputChars } : {}),
        totalCost,
        costMultiplier: estimate.estimateType === 'exact' ? 1 : estimation.costMultiplier,
        estimateType: estimate.estimateType,
        ...(estimate.note ? { note: estimate.note } : {})
      })
    }
  }

  return estimates
}
