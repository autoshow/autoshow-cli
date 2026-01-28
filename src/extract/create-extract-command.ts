import { Command } from 'commander'
import { l, err, success } from '@/logging'
import type { ExtractOptions, EpubExtractOptions } from '@/extract/extract-types'
import { createJsonOutput, setJsonError, outputJson, type ExtractJsonOutput } from '@/utils'

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
      const jsonBuilder = createJsonOutput<ExtractJsonOutput>('extract')
      l('Extracting PDF', { pdfFile })
      
      try {
        const validServices = ['zerox', 'unpdf', 'textract']
        if (options.service && !validServices.includes(options.service)) {
          setJsonError(jsonBuilder, `Invalid service: ${options.service}`)
          outputJson(jsonBuilder)
          err('Invalid service', { service: options.service, availableServices: validServices.join(', ') })
        }
        
        const { extractPdf } = await import('./extract-pdf')
        const result = await extractPdf(pdfFile, options)
        
        if (result.success) {
          jsonBuilder.output.data = {
            inputPath: pdfFile,
            outputPath: result.outputPath || '',
            service: options.service || 'zerox'
          }
          outputJson(jsonBuilder)
          success('Text extracted to', { outputPath: result.outputPath })
          if (result.totalCost !== undefined) {
            l('Total cost', { totalCost: result.totalCost.toFixed(4) })
          }
        } else {
          setJsonError(jsonBuilder, result.error || 'Unknown error')
          outputJson(jsonBuilder)
          err('Failed to extract PDF', { error: result.error })
        }
      } catch (error) {
        setJsonError(jsonBuilder, error as Error)
        outputJson(jsonBuilder)
        err('Error extracting PDF', { error: (error as Error).message })
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
      l('Batch extracting PDFs from', { directory })
      
      try {
        const validServices = ['zerox', 'unpdf', 'textract']
        if (options.service && !validServices.includes(options.service)) {
          err('Invalid service', { service: options.service, availableServices: validServices.join(', ') })
        }
        
        const { batchExtractPdfs } = await import('./batch-pdfs')
        const result = await batchExtractPdfs(directory, options)
        
        if (result.success) {
          success('Processed PDFs', { filesProcessed: result.filesProcessed })
          if (result.totalCost !== undefined) {
            l('Total cost', { totalCost: result.totalCost.toFixed(4) })
          }
        } else {
          err('Failed to process PDFs', { error: result.error })
          if (result.failedFiles && result.failedFiles.length > 0) {
            l('Failed files', { failedFiles: result.failedFiles.join(', ') })
          }
        }
      } catch (error) {
        err('Error processing batch PDFs', { error: (error as Error).message })
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
      l('Extracting EPUB', { inputPath })
      
      try {
        const parsedOptions: EpubExtractOptions = {
          output: options.output,
          maxChars: options.maxChars ? parseInt(String(options.maxChars), 10) : undefined,
          split: options.split ? parseInt(String(options.split), 10) : undefined
        }
        
        if (parsedOptions.split !== undefined && parsedOptions.split <= 0) {
          err('--split must be a positive number')
        }
        
        if (parsedOptions.split && parsedOptions.maxChars) {
          l('Both --split and --max-chars provided; using --split')
        }
        
        const { extractEpub } = await import('./extract-epub')
        const result = await extractEpub(inputPath, parsedOptions)
        
        if (result.success) {
          if ('outputDir' in result && result.outputDir) {
            success('Text extracted to', { outputDir: result.outputDir })
            if (result.filesCreated) {
              l('Files created', { filesCreated: result.filesCreated })
            }
          } else if ('epubsProcessed' in result) {
            success('Processed EPUB files', { epubsProcessed: result.epubsProcessed })
          }
        } else {
          err('Failed to extract EPUB', { error: result.error })
        }
      } catch (error) {
        err('Error extracting EPUB', { error: (error as Error).message })
      }
    })

  extract.addHelpText('after', `
Examples:
  $ autoshow-cli extract pdf ./input/document.pdf
  $ autoshow-cli extract pdf ./input/document.pdf --service textract
  $ autoshow-cli extract batch ./input/ -o ./output/
  $ autoshow-cli extract epub ./input/sum-david-eagleman.epub --split 10
`)

  return extract
}