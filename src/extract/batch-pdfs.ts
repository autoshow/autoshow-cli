import { l, err, success } from '@/logging'
import { stat, readdir, join, basename, ensureDir, sleep } from '@/node-utils'
import { extractPdf } from './extract-pdf'
import type { BatchExtractResult, ExtractOptions } from '@/extract/extract-types'

const p = '[extract/batch-pdfs]'

const isDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    const stats = await stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export const batchExtractPdfs = async (
  directory: string,
  options: ExtractOptions
): Promise<BatchExtractResult> => {
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    const isDir = await isDirectory(directory)
    if (!isDir) {
      throw new Error(`Directory not found: ${directory}`)
    }
    
    const files = await readdir(directory)
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'))
    
    if (pdfFiles.length === 0) {
      throw new Error(`No PDF files found in directory: ${directory}`)
    }
    
    l(`${p}[${requestId}] Processing PDF files`, { count: pdfFiles.length, service: options.service || 'zerox' })
    
    const outputDir = options.output || directory
    await ensureDir(outputDir)
    
    let totalCost = 0
    let successCount = 0
    const failedFiles: string[] = []
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = join(directory, pdfFile)
      const outputPath = join(outputDir, `${basename(pdfFile, '.pdf')}_extracted.txt`)
      
      l(`${p}[${requestId}] Processing`, { current: successCount + failedFiles.length + 1, total: pdfFiles.length, pdfFile })
      
      const result = await extractPdf(pdfPath, {
        ...options,
        output: outputPath
      })
      
      if (result.success) {
        successCount++
        if (result.totalCost) {
          totalCost += result.totalCost
        }
      } else {
        failedFiles.push(pdfFile)
        l(`${p}[${requestId}] Failed`, { pdfFile, error: result.error })
      }
      
      if (successCount + failedFiles.length < pdfFiles.length) {
        await sleep(3000)
      }
    }
    
    success(`${p}[${requestId}] Batch complete`, { successCount, total: pdfFiles.length })
    
    const result: BatchExtractResult = {
      success: failedFiles.length === 0,
      filesProcessed: successCount
    }
    
    if ((options.service === 'zerox' || options.service === 'textract') && totalCost > 0) {
      result.totalCost = totalCost
      l(`${p}[${requestId}] Total cost`, { totalCost: totalCost.toFixed(4) })
    }
    
    if (failedFiles.length > 0) {
      result.failedFiles = failedFiles
    }
    
    return result
  } catch (error) {
    err(`${p}[${requestId}] Batch processing error`, { error: error instanceof Error ? error.message : 'Unknown error' })
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}