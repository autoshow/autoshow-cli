import { l, err } from '@/logging'
import { readFile } from '@/node-utils'
import type { ExtractOptions } from '@/extract/extract-types'

const p = '[extract/extract-services/unpdf]'

export const extractWithUnpdf = async (
  pdfPath: string,
  options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    
    const buffer = await readFile(pdfPath)
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const extractedData = await extractText(pdf, { mergePages: false })
    
    const separator = options.pageBreaks && extractedData.totalPages > 1
      ? '\n\n--- Page Break ---\n\n'
      : '\n\n'
    const text = extractedData.text.join(separator)
    
    l(`${p}[${requestId}] Extracted${pageInfo}`, { characters: text.length, totalPages: extractedData.totalPages })
    
    return { text }
  } catch (error) {
    err(`${p}[${requestId}] Unpdf error${pageInfo}`, { error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}