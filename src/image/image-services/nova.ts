import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { l } from '@/logging'
import { saveImage, parseResolution, generateTimestamp, parseIntOption, parseFloatOption, isApiError, ensureDependencies } from '../image-utils'
import { env } from '@/node-utils'
import type { ImageGenerationResult, NovaCanvasPayload } from '../image-types'

const bedrockRuntimeClient = new BedrockRuntimeClient({ 
  region: env['AWS_REGION'] || 'us-east-1',
  maxAttempts: 3,
  requestHandler: { requestTimeout: 300000, httpsAgent: { connectTimeout: 300000 } }
})

export async function generateImageWithNova(prompt: string, options: any): Promise<ImageGenerationResult> {
  const startTime = Date.now()
  
  try {
    await ensureDependencies()
    
    const { width, height } = parseResolution(options.resolution || '1024x1024')
    const config = {
      width,
      height,
      quality: options.quality || 'standard',
      cfgScale: parseFloatOption(options.cfgScale || '6.5', 6.5),
      seed: options.seed ? parseIntOption(options.seed, 0) : Math.floor(Math.random() * 858993460),
      numberOfImages: parseIntOption(options.count || '1', 1)
    }
    
    const payload: NovaCanvasPayload = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt,
        ...(options.negative && { negativeText: options.negative })
      },
      imageGenerationConfig: config
    }
    
    l.dim(`Invoking Nova Canvas model`)
    const response = await bedrockRuntimeClient.send(new InvokeModelCommand({
      modelId: 'amazon.nova-canvas-v1:0',
      body: JSON.stringify(payload)
    }))
    
    const result = JSON.parse(new TextDecoder().decode(response.body))
    
    if (result.error) {
      if (!result.error.includes('Some of')) {
        throw new Error(result.error)
      }
      l.warn(`Some images blocked by content filters`)
    }
    
    const images = result.images || []
    
    const timestamp = generateTimestamp()
    const outputPaths = images.map((image: string, index: number) => {
      const filename = (options.output || 'nova-{timestamp}-{index}.png')
        .replace('{timestamp}', timestamp)
        .replace('{index}', String(index + 1))
      saveImage(image, filename)
      return filename
    })
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`Generated ${images.length} image(s) in ${duration}s`)
    
    return { success: true, path: outputPaths[0] ?? '', seed: config.seed }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}