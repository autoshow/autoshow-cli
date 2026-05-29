import { extname } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { validateAnthropicOcrModel, validateDeepinfraOcrModel, validateGeminiOcrModel, validateGlmOcrModel, validateGrokOcrModel, validateKimiOcrModel, validateMistralOcrModel, validateOpenAIOcrModel, validateUnstructuredOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { getExtractEstimation, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif', '.bmp'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1
const FIRECRAWL_MODEL = 'firecrawl'
const OCR_INPUT_TOKENS_PER_PAGE = 4000
const OCR_OUTPUT_TOKENS_PER_PAGE = 1000
const OPENAI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed OpenAI OCR benchmark usage. Actual OpenAI OCR cost is computed from response usage after execution.'
export const ANTHROPIC_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Anthropic OCR benchmark usage. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'
export const GEMINI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Gemini OCR benchmark usage. Actual Gemini OCR cost is computed from response usage after execution.'
export const GLM_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed GLM OCR benchmark usage. Actual GLM OCR cost is computed from response usage after execution.'
export const GROK_OCR_PRICE_NOTE = 'Provisional heuristic token estimate of 4000 input tokens and 1000 output tokens per page until Grok OCR calibration data is available. Actual Grok OCR cost is computed from response usage after execution.'
export const DEEPINFRA_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed DeepInfra OCR benchmark usage. Actual DeepInfra OCR cost is computed from response usage after execution.'
export const KIMI_OCR_PRICE_NOTE = 'Model-specific heuristic token estimate based on observed Kimi OCR benchmark usage. Actual Kimi OCR cost is computed from response usage after execution. AutoShow uses Kimi cache-miss input pricing for conservative estimates.'

export const FIRECRAWL_PRICE_NOTE = 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'

type TokenOcrProvider = 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra'

export const estimateOcrTokenUsage = (
  provider: TokenOcrProvider,
  model: string,
  pageCount: number
): { promptTokens: number, completionTokens: number } => {
  const estimation = getExtractEstimation(provider, model)
  const promptTokensPerPage = estimation.promptTokensPerPage ?? OCR_INPUT_TOKENS_PER_PAGE
  const completionTokensPerPage = estimation.completionTokensPerPage ?? OCR_OUTPUT_TOKENS_PER_PAGE

  return {
    promptTokens: Math.max(0, Math.round(pageCount * promptTokensPerPage)),
    completionTokens: Math.max(0, Math.round(pageCount * completionTokensPerPage))
  }
}

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

const resolveExtractInputPageCount = (input: string): Promise<number | undefined> => {
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

export const estimateUnstructuredOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{ provider: 'unstructured', model: string, pageCount: number, costPer1kPagesCents: number, totalCost: number }> => {
  const model = validateUnstructuredOcrModel(modelRaw)
  const pricing = getExtractPricing('unstructured', model)
  const costPer1kPagesCents = pricing.costPer1kPagesCents ?? 3000
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT

  return {
    provider: 'unstructured',
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
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('glm', model, pageCount)

  return {
    provider: 'glm',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
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
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('openai', model, pageCount)

  return {
    provider: 'openai',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
    estimateType: 'heuristic',
    note: OPENAI_OCR_PRICE_NOTE
  }
}

export const estimateGrokOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'grok'
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
  const model = validateGrokOcrModel(modelRaw)
  const pricing = getExtractPricing('grok', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 125
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 250
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('grok', model, pageCount)

  return {
    provider: 'grok',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
    estimateType: 'heuristic',
    note: GROK_OCR_PRICE_NOTE
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
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('anthropic', model, pageCount)

  return {
    provider: 'anthropic',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
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
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('gemini', model, pageCount)

  return {
    provider: 'gemini',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
    estimateType: 'heuristic'
  }
}

export const estimateDeepinfraOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'deepinfra'
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
  const model = validateDeepinfraOcrModel(modelRaw)
  const pricing = getExtractPricing('deepinfra', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 9
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 19
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('deepinfra', model, pageCount)

  return {
    provider: 'deepinfra',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
    estimateType: 'heuristic',
    note: DEEPINFRA_OCR_PRICE_NOTE
  }
}

export const estimateKimiOcrCost = async (
  modelRaw: string,
  input: string
): Promise<{
  provider: 'kimi'
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
  const model = validateKimiOcrModel(modelRaw)
  const pricing = getExtractPricing('kimi', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 95
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 400
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const { promptTokens, completionTokens } = estimateOcrTokenUsage('kimi', model, pageCount)

  return {
    provider: 'kimi',
    model,
    pageCount,
    promptTokens,
    completionTokens,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents,
    estimateType: 'heuristic',
    note: KIMI_OCR_PRICE_NOTE
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

export const computeActualGrokOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'grok'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateGrokOcrModel(modelRaw)
  const pricing = getExtractPricing('grok', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 125
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 250

  return {
    provider: 'grok',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export const computeActualDeepinfraOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'deepinfra'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateDeepinfraOcrModel(modelRaw)
  const pricing = getExtractPricing('deepinfra', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 9
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 19

  return {
    provider: 'deepinfra',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export const computeActualKimiOcrCost = (
  modelRaw: string,
  promptTokens: number,
  completionTokens: number
): {
  provider: 'kimi'
  model: string
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  totalCost: number
} => {
  const model = validateKimiOcrModel(modelRaw)
  const pricing = getExtractPricing('kimi', model)
  const inputCostPer1MCents = pricing.inputCostPer1MCents ?? 95
  const outputCostPer1MCents = pricing.outputCostPer1MCents ?? 400

  return {
    provider: 'kimi',
    model,
    inputCostPer1MCents,
    outputCostPer1MCents,
    totalCost: (promptTokens / 1_000_000) * inputCostPer1MCents
      + (completionTokens / 1_000_000) * outputCostPer1MCents
  }
}

export { OPENAI_OCR_PRICE_NOTE }
