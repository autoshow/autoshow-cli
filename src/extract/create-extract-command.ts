import { Command } from 'commander'
import { l, err } from '@/logging'
import type { ExtractOptions, EpubExtractOptions } from '@/extract/extract-types'

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
      l.opts(`Extracting PDF: ${pdfFile}`)
      
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
      l.opts(`Batch extracting PDFs from: ${directory}`)
      
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

  extract
    .command('epub')
    .description('Extract text from EPUB files for TTS processing')
    .argument('<path>', 'Path to EPUB file or directory containing EPUB files')
    .option('-o, --output <path>', 'Output directory (defaults to output/<filename>)')
    .option('--max-chars <number>', 'Max characters per output file (default: 39000)')
    .option('--split <number>', 'Split into exactly N files of roughly equal length')
    .action(async (inputPath: string, options: EpubExtractOptions) => {
      l.opts(`Extracting EPUB: ${inputPath}`)
      
      try {
        // Parse numeric options
        const parsedOptions: EpubExtractOptions = {
          output: options.output,
          maxChars: options.maxChars ? parseInt(String(options.maxChars), 10) : undefined,
          split: options.split ? parseInt(String(options.split), 10) : undefined
        }
        
        // Validate split option
        if (parsedOptions.split !== undefined && parsedOptions.split <= 0) {
          err('--split must be a positive number')
        }
        
        // Warn if both options provided
        if (parsedOptions.split && parsedOptions.maxChars) {
          l.warn('Both --split and --max-chars provided; using --split')
        }
        
        const { extractEpub } = await import('./extract-epub')
        const result = await extractEpub(inputPath, parsedOptions)
        
        if (result.success) {
          if ('outputDir' in result && result.outputDir) {
            l.success(`Text extracted to: ${result.outputDir}`)
            if (result.filesCreated) {
              l.opts(`Files created: ${result.filesCreated}`)
            }
          } else if ('epubsProcessed' in result) {
            l.success(`Processed ${result.epubsProcessed} EPUB file(s)`)
          }
        } else {
          err(`Failed to extract EPUB: ${result.error}`)
        }
      } catch (error) {
        err(`Error extracting EPUB: ${(error as Error).message}`)
      }
    })

  return extract
}