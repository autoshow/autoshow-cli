import type { ExtractStepEstimate, ResolvedStep2Execution, RuntimeOptions } from '~/types'
import { estimateFirecrawlScrapeCost } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

export type ArticleEstimateResult = {
  estimates: ExtractStepEstimate[]
  notes: string[]
}

export const buildArticleEstimates = (
  resolvedStep2: Extract<ResolvedStep2Execution, { route: 'article' }>,
  opts: RuntimeOptions,
  isRemoteTarget: boolean
): ArticleEstimateResult => {
  const estimates: ExtractStepEstimate[] = []
  const notes: string[] = []

  if (resolvedStep2.backend === 'firecrawl' && isRemoteTarget) {
    const estimate = estimateFirecrawlScrapeCost()
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    const totalCost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      costPer1kPagesCents: estimate.costPer1kPagesCents,
      pageCount: estimate.pageCount,
      totalCost,
      costMultiplier: estimation.costMultiplier,
      estimateType: estimate.estimateType,
      note: estimate.note
    })
  }

  if (resolvedStep2.backend === 'glm-reader' && isRemoteTarget) {
    notes.push('GLM Reader cost is not estimated locally during preflight.')
  }

  if (!isRemoteTarget) {
    if (opts.urlBackend === 'firecrawl') {
      notes.push('Local HTML inputs always use the defuddle backend; --url-backend firecrawl is ignored.')
    }
    if (opts.urlBackend === 'glm-reader') {
      notes.push('Local HTML inputs always use the defuddle backend; --url-backend glm-reader is ignored.')
    }
  }

  if (hasConfiguredOcrProviderSelection(opts)) {
    notes.push(HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING)
  }

  return { estimates, notes }
}
