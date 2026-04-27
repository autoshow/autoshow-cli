import { extname } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { validateAnthropicOcrModel, validateGeminiOcrModel, validateGlmOcrModel, validateMistralOcrModel, validateOpenAIOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif', '.bmp'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1
const FIRECRAWL_MODEL = 'firecrawl'
const OPENAI_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 prompt tokens per page. Actual OpenAI OCR cost is computed from response usage after execution.'
export const ANTHROPIC_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 total tokens per page. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'

export const FIRECRAWL_PRICE_NOTE = 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'

const hasImageExtension = (input: string): boolean => {
  const ext = extname(input).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number])
}

const hasPdfExtension = (input: string): boolean => extname(input).toLowerCase() === '.pdf'

const isRemoteUrl = (input: string): boolean => /^https?:\/\//i.test(input)

const downloadToTemp = async (url: string): Promise<string> => {
  const tempPath = join(tmpdir(), `autoshow-price-${randomUUID()}.pdf`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(tempPath, buffer)
  return tempPath
}

const pageCountCache = new Map<string, Promise<number | undefined>>()

export const resolveExtractInputPageCount = (input: string): Promise<number | undefined> => {
  const cached = pageCountCache.get(input)
  if (cached) return cached

  const promise = resolveExtractInputPageCountUncached(input)
  pageCountCache.set(input, promise)
  return promise
}

const resolveExtractInputPageCountUncached = async (input: string): Promise<number | undefined> => {
  if (hasImageExtension(input)) return 1
  if (!hasPdfExtension(input)) return undefined

  let localPath = input
  let tempFile: string | undefined
  try {
    if (isRemoteUrl(input)) {
      tempFile = await downloadToTemp(input)
      localPath = tempFile
    }
    const info = await getDocumentInfo(localPath)
    return Math.max(1, info.pageCount)
  } catch {
    return undefined
  } finally {
    if (tempFile) {
      await unlink(tempFile).catch(() => {})
    }
  }
}

export const estimateGcloudDocaiCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'gcloud-docai', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = modelRaw
  const pricing = getExtractPricing('gcloud-docai', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 150
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'gcloud-docai',
    model,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents
  }
}

export const estimateAwsTextractCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'aws-textract', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = modelRaw
  const pricing = getExtractPricing('aws-textract', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 150
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'aws-textract',
    model,
    pageCount,
    costPer1kPagesCents,
    totalCost: (pageCount / 1000) * costPer1kPagesCents
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

export const estimateOpenAIOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'openai'
  model: string
  pageCount: number
  promptTokens: number
  completionTokens: number
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  estimateType: 'heuristic'
  note: string
}> => {
  const model = validateOpenAIOcrModel(modelRaw)
  const pricing = getExtractPricing('openai', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 20
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 125
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const promptTokens = pageCount * 4000
  const completionTokens = 0

  return {
    provider: 'openai',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents,
    estimateType: 'heuristic',
    note: OPENAI_OCR_PRICE_NOTE
  }
}

export const estimateAnthropicOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'anthropic'
  model: string
  pageCount: number
  promptTokens: number
  completionTokens: number
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  estimateType: 'heuristic'
  note: string
}> => {
  const model = validateAnthropicOcrModel(modelRaw)
  const pricing = getExtractPricing('anthropic', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 100
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 500
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const promptTokens = pageCount * 4000
  const completionTokens = 0

  return {
    provider: 'anthropic',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents,
    estimateType: 'heuristic',
    note: ANTHROPIC_OCR_PRICE_NOTE
  }
}

export const estimateGeminiOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'gemini'
  model: string
  pageCount: number
  promptTokens: number
  completionTokens: number
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
  estimateType: 'heuristic'
}> => {
  const model = validateGeminiOcrModel(modelRaw)
  const pricing = getExtractPricing('gemini', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 25
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 150
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const promptTokens = pageCount * 4000
  const completionTokens = 0

  return {
    provider: 'gemini',
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

export const computeActualOpenAIOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'openai'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateOpenAIOcrModel(modelRaw)
  const pricing = getExtractPricing('openai', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 20
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 125

  return {
    provider: 'openai',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export const computeActualAnthropicOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'anthropic'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateAnthropicOcrModel(modelRaw)
  const pricing = getExtractPricing('anthropic', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 100
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 500

  return {
    provider: 'anthropic',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export const computeActualGeminiOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'gemini'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateGeminiOcrModel(modelRaw)
  const pricing = getExtractPricing('gemini', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 25
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 150

  return {
    provider: 'gemini',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export { OPENAI_OCR_PRICE_NOTE }
