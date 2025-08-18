import { Command } from 'commander'
import { l, err, logInitialFunctionCall } from '@/logging'
import type { ExtractOptions } from '@/extract/extract-types'

export const createExtractCommand = (): Command => {
  const extract = new Command('extract')
    .description('Extract text from PDF files using AI-powered OCR or local extraction')

  extract
    .command('pdf')
    .description('Extract text from a single PDF file')
    .argument('<pdf-file>', 'Path to the PDF file to process')
    .option('-o, --output <path>', 'Output file path (defaults to <input>_extracted.txt)')
    .option('--page-breaks', 'Include page break markers in output')
    .option('--model <model>', 'Model to use: gpt-4.1, gpt-4.1-mini (default), gemini-2.0-flash', 'gpt-4.1-mini')
    .option('--service <service>', 'Extraction service: zerox (default), unpdf, textract', 'zerox')
    .action(async (pdfFile: string, options: ExtractOptions) => {
      logInitialFunctionCall('extractPdfCommand', { pdfFile, ...options })
      
      try {
        const validServices = ['zerox', 'unpdf', 'textract']
        if (options.service && !validServices.includes(options.service)) {
          err(`Invalid service: ${options.service}. Available services: ${validServices.join(', ')}`)
        }
        
        const { extractPdf } = await import('./extract-pdf')
        const result = await extractPdf(pdfFile, options)
        
        if (result.success) {
          l.success(`Text extracted to: ${result.outputPath}`)
          if (result.totalCost !== undefined) {
            l.opts(`Total cost: $${result.totalCost.toFixed(4)}`)
          }
        } else {
          err(`Failed to extract PDF: ${result.error}`)
        }
      } catch (error) {
        err(`Error extracting PDF: ${(error as Error).message}`)
      }
    })

  extract
    .command('batch')
    .description('Process multiple PDF files from a directory')
    .argument('<directory>', 'Directory containing PDF files')
    .option('-o, --output <dir>', 'Output directory (defaults to same as input)')
    .option('--page-breaks', 'Include page break markers in output')
    .option('--model <model>', 'Model to use: gpt-4.1, gpt-4.1-mini (default), gemini-2.0-flash', 'gpt-4.1-mini')
    .option('--service <service>', 'Extraction service: zerox (default), unpdf, textract', 'zerox')
    .action(async (directory: string, options: ExtractOptions) => {
      logInitialFunctionCall('extractBatchCommand', { directory, ...options })
      
      try {
        const validServices = ['zerox', 'unpdf', 'textract']
        if (options.service && !validServices.includes(options.service)) {
          err(`Invalid service: ${options.service}. Available services: ${validServices.join(', ')}`)
        }
        
        const { batchExtractPdfs } = await import('./batch-pdfs')
        const result = await batchExtractPdfs(directory, options)
        
        if (result.success) {
          l.success(`Processed ${result.filesProcessed} PDFs`)
          if (result.totalCost !== undefined) {
            l.opts(`Total cost: $${result.totalCost.toFixed(4)}`)
          }
        } else {
          err(`Failed to process PDFs: ${result.error}`)
          if (result.failedFiles && result.failedFiles.length > 0) {
            l.warn(`Failed files: ${result.failedFiles.join(', ')}`)
          }
        }
      } catch (error) {
        err(`Error processing batch PDFs: ${(error as Error).message}`)
      }
    })

  return extract
}