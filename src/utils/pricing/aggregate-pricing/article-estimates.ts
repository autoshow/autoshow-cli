import type { ExtractStepEstimate, ResolvedStep2Execution, RuntimeOptions } from '~/types'
import { estimateFirecrawlScrapeCost } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

type ArticleEstimateResult = {
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
  const backends = resolvedStep2.backends ?? [resolvedStep2.backend]

  for (const backend of backends) {
    if (backend === 'defuddle') {
      estimates.push({
        step: 'extract',
        provider: 'defuddle',
        model: 'defuddle',
        totalCost: 0,
        costMultiplier: 1,
        estimateType: 'exact',
        note: 'Local Defuddle article extraction runs on local CPU and is not billed by AutoShow.'
      })
      continue
    }

    if (!isRemoteTarget) {
      continue
    }

    if (backend === 'firecrawl') {
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
      continue
    }

    const model = backend
    const pricing = getExtractPricing(backend, model)
    const estimation = getExtractEstimation(backend, model)
    const totalCost = applyCostMultiplier((1 / 1000) * (pricing.costPer1kPagesCents ?? 0), estimation.costMultiplier)
    estimates.push({
      step: 'extract',
      provider: backend,
      model,
      ...(typeof pricing.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: pricing.costPer1kPagesCents } : {}),
      pageCount: 1,
      totalCost,
      costMultiplier: estimation.costMultiplier,
      estimateType: 'exact'
    })
  }

  if (
    !isRemoteTarget &&
    backends.some((backend) => backend !== 'defuddle')
  ) {
    notes.push('Local HTML inputs always use the defuddle backend; hosted URL backends are skipped.')
  }

  if (!isRemoteTarget && opts.urlBackend !== 'defuddle') {
    notes.push(`Local HTML inputs always use the defuddle backend; --url-backend ${opts.urlBackend} is ignored.`)
  }

  if (hasConfiguredOcrProviderSelection(opts)) {
    notes.push(HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING)
  }

  return { estimates, notes }
}
