import { extname } from 'node:path'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { validateGlmOcrModel, validateMistralOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1
const FIRECRAWL_MODEL = 'firecrawl'

export const FIRECRAWL_PRICE_NOTE = 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'

const hasImageExtension = (input: string): boolean => {
  const ext = extname(input).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number])
}

const hasPdfExtension = (input: string): boolean => extname(input).toLowerCase() === '.pdf'

export const resolveExtractInputPageCount = async (input: string): Promise<number | undefined> => {
  if (hasImageExtension(input)) return 1
  if (!hasPdfExtension(input)) return undefined

  try {
    const info = await getDocumentInfo(input)
    return Math.max(1, info.pageCount)
  } catch {
    return undefined
  }
}

export const estimateMistralOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'mistral', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = validateMistralOcrModel(modelRaw)
  const pricing = getExtractPricing('mistral', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 200
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'mistral',
    model,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents
  }
}

export const estimateGlmOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'glm'
  model: string
  pageCount: number
  promptTokens: number
  completionTokens: number
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  estimateType: 'heuristic'
}> => {
  const model = validateGlmOcrModel(modelRaw)
  const pricing = getExtractPricing('glm', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 3
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 3
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const promptTokens = pageCount * 4000
  const completionTokens = 0

  return {
    provider: 'glm',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents,
    estimateType: 'heuristic'
  }
}

export const estimateFirecrawlScrapeCost = (): {
  provider: 'firecrawl'
  model: string
  pageCount: number
  costPer1kPagesCents: number
  totalCost: number
  estimateType: 'exact'
  note: string
} => {
  const pricing = getExtractPricing('firecrawl', FIRECRAWL_MODEL)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 83
  const pageCount = DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'firecrawl',
    model: FIRECRAWL_MODEL,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents,
    estimateType: 'exact',
    note: FIRECRAWL_PRICE_NOTE
  }
}

export const computeActualGlmOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'glm'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateGlmOcrModel(modelRaw)
  const pricing = getExtractPricing('glm', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 3
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 3

  return {
    provider: 'glm',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}
