export type ModelKey = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gemini-2.0-flash' | 'gemini-2.0-flash-lite'

export type ExtractService = 'zerox' | 'unpdf' | 'textract'

export interface ExtractOptions {
  output?: string
  pageBreaks?: boolean
  model?: string
  service?: ExtractService
}

export interface SinglePageExtractResult {
  text: string
  pageNumber: number
  cost?: number
}

export interface ExtractResult {
  success: boolean
  outputPath?: string
  totalCost?: number
  error?: string
  details?: string
}

export interface BatchExtractResult {
  success: boolean
  filesProcessed?: number
  totalCost?: number
  error?: string
  failedFiles?: string[]
}