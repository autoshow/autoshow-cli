import { l, err } from '@/logging'
import { fs, path, execSync, ensureDir } from '@/node-utils'
import { sleep } from '@/node-utils'
import type { ExtractResult, ExtractOptions, ExtractService, SinglePageExtractResult } from '@/types'
import { extractWithZerox } from './extract-services/zerox'
import { extractWithUnpdf } from './extract-services/unpdf'
import { extractWithTextract } from './extract-services/textract'

const p = '[extract/extract-pdf]'

const splitPdfIntoPages = async (pdfPath: string, requestId: string): Promise<string[]> => {
  l.dim(`${p}[${requestId}] Splitting PDF into individual pages`)
  
  const tempDir = path.join('output', 'temp', requestId, 'pages')
  await ensureDir(tempDir)
  
  try {
    execSync('gm version', { stdio: 'ignore' })
  } catch (error) {
    l.dim(`${p}[${requestId}] GraphicsMagick not found, will process as single file`)
    return [pdfPath]
  }
  
  try {
    const identifyOutput = execSync(`gm identify -format "%p " "${pdfPath}"`, { encoding: 'utf-8' })
    const pageCount = identifyOutput.trim().split(' ').filter(p => p).length
    l.dim(`${p}[${requestId}] PDF has ${pageCount} page(s)`)
    
    if (pageCount === 1) {
      l.dim(`${p}[${requestId}] Single page PDF, no splitting needed`)
      return [pdfPath]
    }
    
    const pagePaths: string[] = []
    
    for (let i = 0; i < pageCount; i++) {
      const pageFile = path.join(tempDir, `page_${String(i + 1).padStart(3, '0')}.pdf`)
      const pageRange = `[${i}]`
      
      l.dim(`${p}[${requestId}] Extracting page ${i + 1}/${pageCount}`)
      execSync(`gm convert "${pdfPath}${pageRange}" "${pageFile}"`, { stdio: 'ignore' })
      
      pagePaths.push(pageFile)
    }
    
    l.dim(`${p}[${requestId}] Successfully split PDF into ${pagePaths.length} pages`)
    return pagePaths
    
  } catch (error) {
    l.dim(`${p}[${requestId}] Error splitting PDF, processing as single file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return [pdfPath]
  }
}

const extractSinglePage = async (
  pagePath: string,
  pageNumber: number,
  options: ExtractOptions,
  requestId: string,
  service: ExtractService
): Promise<SinglePageExtractResult> => {
  l.dim(`${p}[${requestId}] Processing page ${pageNumber}`)
  
  try {
    const { text, totalCost } = service === 'zerox' 
      ? await extractWithZerox(pagePath, options, requestId, pageNumber)
      : service === 'unpdf'
      ? await extractWithUnpdf(pagePath, options, requestId, pageNumber)
      : await extractWithTextract(pagePath, options, requestId, pageNumber)
    
    l.dim(`${p}[${requestId}] Page ${pageNumber} extracted: ${text.length} characters`)
    
    const result: SinglePageExtractResult = {
      text,
      pageNumber
    }
    
    if (totalCost) {
      result.cost = totalCost
    }
    
    return result
  } catch (error) {
    l.dim(`${p}[${requestId}] Error extracting page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

const cleanupTempFiles = async (requestId: string): Promise<void> => {
  const tempDir = path.join('output', 'temp', requestId)
  try {
    await fs.rm(tempDir, { recursive: true, force: true })
    l.dim(`${p}[${requestId}] Cleaned up temp directory`)
  } catch (error) {
    l.dim(`${p}[${requestId}] Error cleaning up temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(filePath)
    return stats.isFile()
  } catch {
    return false
  }
}

export const extractPdf = async (
  pdfPath: string, 
  options: ExtractOptions
): Promise<ExtractResult> => {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  
  l.dim(`${p}[${requestId}] Starting PDF extraction`)
  l.dim(`${p}[${requestId}] PDF path: ${pdfPath}`)
  l.dim(`${p}[${requestId}] Options: ${JSON.stringify(options)}`)
  
  try {
    const pdfExists = await isFile(pdfPath)
    
    if (!pdfExists) {
      throw new Error(`PDF file not found: ${pdfPath}`)
    }
    
    const service = (options.service || 'zerox') as ExtractService
    l.dim(`${p}[${requestId}] Using extraction service: ${service}`)
    
    let finalText = ''
    let totalCost = 0
    let pageResults: SinglePageExtractResult[] = []
    
    if (service === 'unpdf') {
      l.dim(`${p}[${requestId}] Processing entire PDF with unpdf (no page splitting)`)
      const { text, totalCost: cost } = await extractWithUnpdf(pdfPath, options, requestId)
      finalText = text
      if (cost) totalCost = cost
      pageResults = [{ text, pageNumber: 1 }]
    } else {
      const pagePaths = await splitPdfIntoPages(pdfPath, requestId)
      
      for (let i = 0; i < pagePaths.length; i++) {
        const pagePath = pagePaths[i]!
        const pageNumber = i + 1
        
        l.opts(`${p}[${requestId}] Processing page ${pageNumber}/${pagePaths.length}`)
        
        const result = await extractSinglePage(
          pagePath,
          pageNumber,
          options,
          requestId,
          service
        )
        
        pageResults.push(result)
        
        if (result.cost) {
          totalCost += result.cost
        }
        
        if (i < pagePaths.length - 1 && service === 'zerox') {
          l.dim(`${p}[${requestId}] Waiting 2 seconds before next page (rate limiting)`)
          await sleep(2000)
        }
      }
      
      const sortedResults = pageResults.sort((a, b) => a.pageNumber - b.pageNumber)
      const pageTexts = sortedResults.map(r => r.text)
      
      finalText = options.pageBreaks && pageTexts.length > 1
        ? pageTexts.join('\n\n--- Page Break ---\n\n')
        : pageTexts.join('\n\n')
    }
    
    const outputPath = options.output || path.join(
      'output',
      `${path.basename(pdfPath, '.pdf')}_extracted.txt`
    )
    
    await ensureDir('output')
    await fs.writeFile(outputPath, finalText, 'utf-8')
    
    await cleanupTempFiles(requestId)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`${p}[${requestId}] Success in ${duration}s - ${outputPath}`)
    l.opts(`${p}[${requestId}] Total characters extracted: ${finalText.length}`)
    l.opts(`${p}[${requestId}] Pages processed: ${pageResults.length}`)
    
    const result: ExtractResult = {
      success: true,
      outputPath
    }
    
    if (totalCost > 0) {
      result.totalCost = totalCost
    }
    
    return result
  } catch (error) {
    await cleanupTempFiles(requestId)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    err(`${p}[${requestId}] Failed in ${duration}s - ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error && error.stack ? error.stack : 'No stack trace available'
    }
  }
}