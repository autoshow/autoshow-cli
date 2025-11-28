import { l, err } from '@/logging'
import { readFile } from '@/node-utils'
import type { ExtractOptions } from '@/extract/extract-types'

const p = '[extract/extract-services/unpdf]'

export const extractWithUnpdf = async (
  pdfPath: string,
  _options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    
    const buffer = await readFile(pdfPath)
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const extractedData = await extractText(pdf, { mergePages: false })
    const text = extractedData.text.join('\n\n')
    
    l.opts(`${p}[${requestId}] Extracted${pageInfo}: ${text.length} characters from ${extractedData.totalPages} pages`)
    
    return { text }
  } catch (error) {
    err(`${p}[${requestId}] Unpdf error${pageInfo}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}