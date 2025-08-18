import { l, err } from '@/logging'
import { fs, path, ensureDir } from '@/node-utils'
import { sleep } from '@/node-utils'
import { extractPdf } from './extract-pdf'
import type { BatchExtractResult, ExtractOptions } from '@/types'

const p = '[extract/batch-pdfs]'

const isDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(dirPath)
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
    
    const files = await fs.readdir(directory)
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'))
    
    if (pdfFiles.length === 0) {
      throw new Error(`No PDF files found in directory: ${directory}`)
    }
    
    l.opts(`${p}[${requestId}] Processing ${pdfFiles.length} PDF files with ${options.service || 'zerox'}`)
    
    const outputDir = options.output || directory
    await ensureDir(outputDir)
    
    let totalCost = 0
    let successCount = 0
    const failedFiles: string[] = []
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(directory, pdfFile)
      const outputPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}_extracted.txt`)
      
      l.opts(`${p}[${requestId}] Processing ${successCount + failedFiles.length + 1}/${pdfFiles.length}: ${pdfFile}`)
      
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
        l.warn(`${p}[${requestId}] Failed: ${pdfFile} - ${result.error}`)
      }
      
      if (successCount + failedFiles.length < pdfFiles.length) {
        await sleep(3000)
      }
    }
    
    l.success(`${p}[${requestId}] Batch complete: ${successCount}/${pdfFiles.length} successful`)
    
    const result: BatchExtractResult = {
      success: failedFiles.length === 0,
      filesProcessed: successCount
    }
    
    if ((options.service === 'zerox' || options.service === 'textract') && totalCost > 0) {
      result.totalCost = totalCost
      l.opts(`${p}[${requestId}] Total cost: $${totalCost.toFixed(4)}`)
    }
    
    if (failedFiles.length > 0) {
      result.failedFiles = failedFiles
    }
    
    return result
  } catch (error) {
    err(`${p}[${requestId}] Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}