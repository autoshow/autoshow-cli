import { basename, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extractPageText, getDocumentInfo, renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { validateAnthropicOcrModel, validateDeepinfraOcrModel, validateDeapiOcrModel, validateGeminiOcrModel, validateGlmOcrModel, validateKimiOcrModel, validateMistralOcrModel, validateOpenAIOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { deapiFetch, extractDeapiErrorMessage, extractPriceUsd, getDeapiApiKey, readJsonOrText } from '~/utils/deapi'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif', '.bmp'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1
export const DEAPI_OCR_DEFAULT_OUTPUT_CHARS_PER_PAGE = 2000
export const DEAPI_OCR_COST_PER_1K_OUTPUT_CHARS_CENTS = 0.928
const FIRECRAWL_MODEL = 'firecrawl'
const OPENAI_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 prompt tokens per page. Actual OpenAI OCR cost is computed from response usage after execution.'
export const ANTHROPIC_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 total tokens per page. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'
export const DEEPINFRA_OCR_PROMPT_TOKENS_PER_PAGE = 4000
export const DEEPINFRA_OCR_COMPLETION_TOKENS_PER_PAGE = 1000
export const DEEPINFRA_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 input tokens plus 1,000 output tokens per page. Actual DeepInfra OCR cost is computed from response usage after execution.'
export const KIMI_OCR_PROMPT_TOKENS_PER_PAGE = 4000
export const KIMI_OCR_COMPLETION_TOKENS_PER_PAGE = 1000
export const KIMI_OCR_PRICE_NOTE = 'Heuristic token estimate based on 4,000 input tokens plus 1,000 output tokens per page. Actual Kimi OCR cost is computed from response usage after execution. AutoShow uses Kimi cache-miss input pricing for conservative estimates.'
export const DEAPI_OCR_PRICE_NOTE = 'Heuristic estimate based on deAPI published OCR output-character pricing. Exact pricing uses the provider quote endpoint when DEAPI_API_KEY is available.'

export const FIRECRAWL_PRICE_NOTE = 'Estimated at Firecrawl Standard plan rate ($83 / 100K credits; /scrape uses 1 credit per page).'

const hasImageExtension = (input: string): boolean => {
  const ext = extname(input).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext as typeof IMAGE_EXTENSIONS[number])
}

const hasPdfExtension = (input: string): boolean => extname(input).toLowerCase() === '.pdf'

const isRemoteUrl = (input: string): boolean => /^https?:\/\//i.test(input)

const normalizeDeapiOcrLanguage = (languages: string | undefined): string | undefined => {
  const first = languages?.split(/[,+\s]+/).find((entry) => entry.trim().length > 0)?.trim().toLowerCase()
  if (!first) {
    return undefined
  }
  if (first === 'eng') {
    return 'en'
  }
  return first.length === 3 ? first.slice(0, 2) : first
}

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

export const estimateDeapiOcrCost = async (
  modelRaw: string,
  input: string,
  options: {
    dpi?: number | undefined
    password?: string | undefined
    rotate?: number | undefined
    languages?: string | undefined
  } = {}
): Promise<{
  provider: 'deapi'
  model: string
  pageCount: number
  estimatedOutputChars?: number
  costPer1kOutputCharsCents: number
  totalCost: number
  estimateType: 'heuristic' | 'exact'
  note?: string
}> => {
  const model = validateDeapiOcrModel(modelRaw)
  const detectedPageCount = await resolveExtractInputPageCount(input)
  const pageCount = typeof detectedPageCount === 'number' ? detectedPageCount : DEFAULT_EXTRACT_PAGE_COUNT
  const apiKey = getDeapiApiKey()
  const language = normalizeDeapiOcrLanguage(options.languages)
  const costPer1kOutputCharsCents = getExtractPricing('deapi', model).costPer1kOutputCharsCents
    ?? DEAPI_OCR_COST_PER_1K_OUTPUT_CHARS_CENTS

  const buildHeuristicEstimate = async (note: string): Promise<{
    provider: 'deapi'
    model: string
    pageCount: number
    estimatedOutputChars: number
    costPer1kOutputCharsCents: number
    totalCost: number
    estimateType: 'heuristic'
    note: string
  }> => {
    const estimatedOutputChars = await estimateDeapiOcrOutputChars(input, pageCount, options.password)
    return {
      provider: 'deapi',
      model,
      pageCount,
      estimatedOutputChars,
      costPer1kOutputCharsCents,
      totalCost: computeDeapiOcrHeuristicCost(estimatedOutputChars, costPer1kOutputCharsCents),
      estimateType: 'heuristic',
      note
    }
  }

  if (!apiKey) {
    return await buildHeuristicEstimate(`DEAPI_API_KEY is not set; ${DEAPI_OCR_PRICE_NOTE}`)
  }

  if (isRemoteUrl(input)) {
    return await buildHeuristicEstimate(`Remote deAPI OCR preflight uses a local heuristic. ${DEAPI_OCR_PRICE_NOTE}`)
  }

  try {
    let totalCost: number
    if (hasImageExtension(input)) {
      totalCost = await requestDeapiOcrImagePrice(apiKey, input, model, language)
    } else if (hasPdfExtension(input)) {
      totalCost = await quoteDeapiOcrPdfPages(apiKey, input, model, pageCount, options, language)
    } else {
      return await buildHeuristicEstimate(`deAPI OCR exact pricing currently supports local image and PDF inputs. ${DEAPI_OCR_PRICE_NOTE}`)
    }

    return {
      provider: 'deapi',
      model,
      pageCount,
      costPer1kOutputCharsCents,
      totalCost,
      estimateType: 'exact'
    }
  } catch (error) {
    return await buildHeuristicEstimate(
      `deAPI OCR exact pricing failed; using published output-character heuristic (${error instanceof Error ? error.message : String(error)}).`
    )
  }
}

export const estimateDeapiOcrOutputCharsForPages = (pageCount: number): number =>
  Math.max(1, pageCount) * DEAPI_OCR_DEFAULT_OUTPUT_CHARS_PER_PAGE

export const computeDeapiOcrHeuristicCost = (
  estimatedOutputChars: number,
  costPer1kOutputCharsCents = DEAPI_OCR_COST_PER_1K_OUTPUT_CHARS_CENTS
): number => (Math.max(0, estimatedOutputChars) / 1000) * costPer1kOutputCharsCents

const estimateDeapiOcrOutputChars = async (
  input: string,
  pageCount: number,
  password?: string | undefined
): Promise<number> => {
  if (!isRemoteUrl(input) && hasPdfExtension(input)) {
    let totalChars = 0
    for (let page = 1; page <= pageCount; page++) {
      try {
        const text = await extractPageText(input, page, password)
        totalChars += text.stdout.trim().length
      } catch {
        // Fall through to the per-page fallback below.
      }
    }
    if (totalChars > 0) {
      return totalChars
    }
  }

  return estimateDeapiOcrOutputCharsForPages(pageCount)
}

const requestDeapiOcrImagePrice = async (
  apiKey: string,
  imagePath: string,
  model: string,
  language?: string | undefined
): Promise<number> => {
  const body = new FormData()
  body.append('image', Bun.file(imagePath), basename(imagePath))
  body.append('model', model)
  body.append('format', 'text')
  if (language) {
    body.append('language', language)
  }

  const response = await deapiFetch('/api/v2/images/ocr/price', {
    apiKey,
    method: 'POST',
    body
  })
  const payload = await readJsonOrText(response)
  if (!response.ok) {
    throw new Error(`deAPI OCR price request failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`)
  }
  const priceUsd = extractPriceUsd(payload)
  if (priceUsd === undefined) {
    throw new Error('deAPI OCR price response did not include data.price')
  }
  return priceUsd * 100
}

const quoteDeapiOcrPdfPages = async (
  apiKey: string,
  input: string,
  model: string,
  pageCount: number,
  options: {
    dpi?: number | undefined
    password?: string | undefined
    rotate?: number | undefined
  },
  language?: string | undefined
): Promise<number> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-deapi-ocr-price-'))
  try {
    let totalCost = 0
    for (let page = 1; page <= pageCount; page++) {
      const imagePath = join(tempDir, `page-${String(page).padStart(3, '0')}.png`)
      const renderResult = await renderPageToImage(
        input,
        page,
        options.dpi ?? 300,
        imagePath,
        options.password,
        options.rotate ?? 0
      )
      if (renderResult.exitCode !== 0) {
        throw new Error(renderResult.stderr || `Failed rendering page ${page} for deAPI OCR price quote`)
      }
      totalCost += await requestDeapiOcrImagePrice(apiKey, imagePath, model, language)
      await rm(imagePath, { force: true })
    }
    return totalCost
  } finally {
    await rm(tempDir, { recursive: true, force: true })
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
  const promptTokens = pageCount * DEEPINFRA_OCR_PROMPT_TOKENS_PER_PAGE
  const completionTokens = pageCount * DEEPINFRA_OCR_COMPLETION_TOKENS_PER_PAGE

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
  const promptTokens = pageCount * KIMI_OCR_PROMPT_TOKENS_PER_PAGE
  const completionTokens = pageCount * KIMI_OCR_COMPLETION_TOKENS_PER_PAGE

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
