import { expect, test } from 'bun:test'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import type { ExtractionMetadata } from '~/types'

test('Unstructured OCR estimates and actuals use Pay-As-You-Go page pricing', () => {
  const pricing = getExtractPricing('unstructured', 'hi_res_and_enrichment')
  expect(pricing.costPer1kPagesCents).toBe(3000)

  const estimated = computeEstimatedCosts({
    applyCostMultipliers: false,
    extractTargets: [{
      provider: 'unstructured',
      model: 'hi_res_and_enrichment',
      pageCount: 1,
      estimateType: 'exact'
    }]
  })

  expect(estimated.totalCost).toBe(3)
  expect(estimated.steps[0]).toMatchObject({
    step: 'extract',
    provider: 'unstructured',
    model: 'hi_res_and_enrichment',
    cost: 3,
    costPer1kPagesCents: 3000,
    pageCount: 1
  })

  const metadata: ExtractionMetadata = {
    extractionMethod: 'unstructured-ocr',
    totalPages: 1,
    ocrPages: 1,
    textPages: 0,
    processingTime: 1234,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 1000,
    ocrService: 'unstructured',
    ocrModel: 'hi_res_and_enrichment'
  }
  const actual = computeActualCosts({ step2: metadata })

  expect(actual.totalCost).toBe(3)
  expect(actual.steps[0]).toMatchObject({
    step: 'extract',
    provider: 'unstructured',
    model: 'hi_res_and_enrichment',
    cost: 3,
    costSource: 'registry_fallback',
    inputMetric: 'pages',
    inputValue: 1
  })
})
