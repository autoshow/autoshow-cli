import { extname } from 'node:path'
import { getDocumentInfo } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { validateMistralOcrModel } from '~/cli/commands/models/model-options'
import { getExtractPricing } from '~/cli/commands/models/model-loader'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff'] as const
const DEFAULT_EXTRACT_PAGE_COUNT = 1

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
