import { l, err, success } from '@/logging'
import { stat, writeFile, rm, join, basename, ensureDir, sleep, execSync } from '@/node-utils'
import type { ExtractResult, ExtractOptions, ExtractService, SinglePageExtractResult } from '@/extract/extract-types'
import { extractWithZerox } from './extract-services/zerox'
import { extractWithUnpdf } from './extract-services/unpdf'
import { extractWithTextract } from './extract-services/textract'

const p = '[extract/extract-pdf]'

const splitPdfIntoPages = async (pdfPath: string, requestId: string): Promise<string[]> => {
  const tempDir = join('output', 'temp', requestId, 'pages')
  await ensureDir(tempDir)
  
  try {
    execSync('gm version', { stdio: 'ignore' })
  } catch (error) {
    return [pdfPath]
  }
  
  try {
    const identifyOutput = execSync(`gm identify -format "%p " "${pdfPath}"`, { encoding: 'utf-8' })
    const pageCount = identifyOutput.trim().split(' ').filter(p => p).length
    
    if (pageCount === 1) {
      return [pdfPath]
    }
    
    l(`${p}[${requestId}] Splitting pages`, { pageCount })
    
    const pagePaths: string[] = []
    
    for (let i = 0; i < pageCount; i++) {
      const pageFile = join(tempDir, `page_${String(i + 1).padStart(3, '0')}.pdf`)
      const pageRange = `[${i}]`
      execSync(`gm convert "${pdfPath}${pageRange}" "${pageFile}"`, { stdio: 'ignore' })
      pagePaths.push(pageFile)
    }
    
    return pagePaths
    
  } catch (error) {
    l(`${p}[${requestId}] Error splitting PDF, processing as single file`)
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
  try {
    const { text, totalCost } = service === 'zerox' 
      ? await extractWithZerox(pagePath, options, requestId, pageNumber)
      : service === 'unpdf'
      ? await extractWithUnpdf(pagePath, options, requestId, pageNumber)
      : await extractWithTextract(pagePath, options, requestId, pageNumber)
    
    const result: SinglePageExtractResult = {
      text,
      pageNumber
    }
    
    if (totalCost) {
      result.cost = totalCost
    }
    
    return result
  } catch (error) {
    err(`${p}[${requestId}] Error extracting page`, { pageNumber, error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}

const cleanupTempFiles = async (requestId: string): Promise<void> => {
  const tempDir = join('output', 'temp', requestId)
  try {
    await rm(tempDir, { recursive: true, force: true })
  } catch (error) {
    l(`${p}[${requestId}] Failed to cleanup temp files`)
  }
}

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    const stats = await stat(filePath)
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
  
  try {
    const pdfExists = await isFile(pdfPath)
    
    if (!pdfExists) {
      throw new Error(`PDF file not found: ${pdfPath}`)
    }
    
    const service = (options.service || 'zerox') as ExtractService
    l(`${p}[${requestId}] Extracting with`, { service })
    
    let finalText = ''
    let totalCost = 0
    let pageResults: SinglePageExtractResult[] = []
    
    if (service === 'unpdf') {
      const { text, totalCost: cost } = await extractWithUnpdf(pdfPath, options, requestId)
      finalText = text
      if (cost) totalCost = cost
      pageResults = [{ text, pageNumber: 1 }]
    } else {
      const pagePaths = await splitPdfIntoPages(pdfPath, requestId)
      
      for (let i = 0; i < pagePaths.length; i++) {
        const pagePath = pagePaths[i]!
        const pageNumber = i + 1
        
        if (pagePaths.length > 1) {
          l(`${p}[${requestId}] Processing page`, { pageNumber, totalPages: pagePaths.length })
        }
        
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
          await sleep(2000)
        }
      }
      
      const sortedResults = pageResults.sort((a, b) => a.pageNumber - b.pageNumber)
      const pageTexts = sortedResults.map(r => r.text)
      
      finalText = options.pageBreaks && pageTexts.length > 1
        ? pageTexts.join('\n\n--- Page Break ---\n\n')
        : pageTexts.join('\n\n')
    }
    
    const outputPath = options.output || join(
      'output',
      `${basename(pdfPath, '.pdf')}_extracted.txt`
    )
    
    await ensureDir('output')
    await writeFile(outputPath, finalText, 'utf-8')
    
    await cleanupTempFiles(requestId)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success(`${p}[${requestId}] Extracted`, { characters: finalText.length, duration })
    
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
    err(`${p}[${requestId}] Failed`, { duration, error: error instanceof Error ? error.message : 'Unknown error' })
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error && error.stack ? error.stack : 'No stack trace available'
    }
  }
}