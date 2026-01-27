import { l, err } from '@/logging'
import type { ExtractOptions, ModelKey } from '@/extract/extract-types'

const p = '[extract/extract-services/zerox]'

const modelConfig = {
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'openai' as const,
    model: 'gpt-4o' as const,
    pricing: { input: 2.50, output: 10.00 }
  },
  'gpt-4o-mini': {
    name: 'GPT-4o mini',
    provider: 'openai' as const,
    model: 'gpt-4o-mini' as const,
    pricing: { input: 0.15, output: 0.60 }
  },
  'gpt-4.1': {
    name: 'GPT-4.1',
    provider: 'openai' as const,
    model: 'gpt-4o' as const,
    pricing: { input: 2.00, output: 8.00 }
  },
  'gpt-4.1-mini': {
    name: 'GPT-4.1 mini',
    provider: 'openai' as const,
    model: 'gpt-4o-mini' as const,
    pricing: { input: 0.40, output: 1.60 }
  },
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    provider: 'google' as const,
    model: 'gemini-2.0-flash-exp' as const,
    pricing: { input: 0.075, output: 0.30 }
  },
  'gemini-2.0-flash-lite': {
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google' as const,
    model: 'gemini-2.0-flash-exp' as const,
    pricing: { input: 0.04, output: 0.15 }
  }
}

const calculateCost = (inputTokens: number, outputTokens: number, pricing: { input: number, output: number }): number => {
  const inputCost = (inputTokens / 1000000) * pricing.input
  const outputCost = (outputTokens / 1000000) * pricing.output
  return inputCost + outputCost
}

const getCredentials = (provider: 'openai' | 'google') => {
  if (provider === 'google') {
    const apiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY']
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set')
    }
    return { apiKey }
  } else {
    const apiKey = process.env['OPENAI_API_KEY']
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    return { apiKey }
  }
}

export const extractWithZerox = async (
  pdfPath: string,
  options: ExtractOptions,
  requestId: string,
  pageNumber?: number
): Promise<{ text: string, totalCost?: number }> => {
  const pageInfo = pageNumber ? ` (page ${pageNumber})` : ''
  
  const selectedModelKey = (options.model || 'gpt-4.1-mini') as ModelKey
  
  if (!modelConfig[selectedModelKey]) {
    throw new Error(`Invalid model: ${options.model}. Available models: ${Object.keys(modelConfig).join(', ')}`)
  }
  
  const selectedModel = modelConfig[selectedModelKey]
  const credentials = getCredentials(selectedModel.provider)
  
  if (pageNumber === 1 || !pageNumber) {
    l(`${p}[${requestId}] Using model`, { modelName: selectedModel.name, provider: selectedModel.provider })
    l(`${p}[${requestId}] Pricing`, { inputPrice: selectedModel.pricing.input, outputPrice: selectedModel.pricing.output, unit: '1M tokens' })
  }
  
  try {
    const { zerox } = await import('zerox')
    const { ModelProvider } = await import('zerox/node-zerox/dist/types')
    
    const modelProvider = selectedModel.provider === 'google' ? ModelProvider.GOOGLE : ModelProvider.OPENAI
    
    const result = await zerox({
      filePath: pdfPath,
      modelProvider: modelProvider,
      model: selectedModel.model,
      credentials: credentials,
      cleanup: true,
      maintainFormat: true,
      concurrency: 1,
      correctOrientation: true,
      trimEdges: true
    })
    
    if (result.summary?.ocr) {
      l(`${p}[${requestId}] OCR${pageInfo}`, { successful: result.summary.ocr.successful, failed: result.summary.ocr.failed })
    }
    
    const totalCost = calculateCost(result.inputTokens, result.outputTokens, selectedModel.pricing)
    l(`${p}[${requestId}] Tokens${pageInfo}`, { inputTokens: result.inputTokens, outputTokens: result.outputTokens })
    l(`${p}[${requestId}] Cost${pageInfo}`, { totalCost: totalCost.toFixed(4) })
    
    const pageContents = result.pages.map((page: any) => page.content)
    const text = pageContents.join('\n\n')
    
    return { text, totalCost }
  } catch (error) {
    err(`${p}[${requestId}] Zerox error${pageInfo}`, { error: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}