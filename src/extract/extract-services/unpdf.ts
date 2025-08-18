import { l, err } from '@/logging'
import { fs } from '@/node-utils'
import type { ExtractOptions } from '@/types'

const p = '[extract/extract-services/unpdf]'

export const extractWithUnpdf = async (
  pdfPath: string,
  _options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  l.dim(`${p}[${requestId}] Using unpdf service for extraction${pageInfo}`)
  
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    
    const buffer = await fs.readFile(pdfPath)
    l.dim(`${p}[${requestId}] PDF file${pageInfo} loaded, size: ${buffer.length} bytes`)
    
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    l.dim(`${p}[${requestId}] PDF document proxy created${pageInfo}`)
    
    const extractedData = await extractText(pdf, { mergePages: false })
    
    const totalPages = extractedData.totalPages
    l.dim(`${p}[${requestId}] Document${pageInfo} has ${totalPages} total pages`)
    
    const text = extractedData.text.join('\n\n')
    
    l.dim(`${p}[${requestId}] Text length${pageInfo}: ${text.length} characters`)
    
    return { text }
  } catch (error) {
    err(`${p}[${requestId}] Unpdf error${pageInfo}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}