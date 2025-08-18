import { writeFile } from 'fs/promises'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../video-utils.ts'
import { env, readFileSync, existsSync } from '@/node-utils'
import type { VideoGenerationResult, VeoGenerateOptions, VeoGenerateConfig } from '@/types'

const p = '[video/video-services/veo]'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

interface VeoApiOperation {
  name: string
  done: boolean
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string
        }
      }>
    }
  }
  error?: {
    message: string
    code: number
  }
}

async function pollOperation(operationName: string, apiKey: string): Promise<VeoApiOperation> {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
  const maxAttempts = 60
  const pollInterval = 10000
  
  l.dim(`${p} Starting polling for operation: ${operationName}`)
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/${operationName}`, {
        headers: { 'x-goog-api-key': apiKey }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to get operation status: ${response.status} ${response.statusText}`)
      }
      
      const operation = await response.json() as VeoApiOperation
      
      if (operation.done) {
        if (operation.error) {
          throw new Error(`Video generation failed: ${operation.error.message}`)
        }
        l.dim(`${p} Operation completed successfully`)
        l.dim(`${p} Response structure: ${JSON.stringify(operation.response, null, 2)}`)
        return operation
      }
      
      l.dim(`${p} Still processing... (attempt ${attempt + 1}/${maxAttempts})`)
      await sleep(pollInterval)
    } catch (error) {
      l.warn(`${p} Polling error: ${isApiError(error) ? error.message : 'Unknown error'}`)
      if (attempt === maxAttempts - 1) {
        throw error
      }
      await sleep(pollInterval)
    }
  }
  
  throw new Error('Video generation timed out after 10 minutes')
}

async function downloadVideo(videoUri: string, apiKey: string, outputPath: string): Promise<void> {
  l.dim(`${p} Downloading video from: ${videoUri}`)
  
  const response = await fetch(videoUri, {
    headers: { 'x-goog-api-key': apiKey }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  await writeFile(outputPath, Buffer.from(buffer))
  l.dim(`${p} Video saved to: ${outputPath}`)
}

async function encodeImageToBase64(imagePath: string): Promise<{ imageBytes: string; mimeType: string }> {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }
  
  const imageBuffer = readFileSync(imagePath)
  const base64 = imageBuffer.toString('base64')
  
  const ext = imagePath.toLowerCase().split('.').pop()
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  
  return { imageBytes: base64, mimeType }
}

export async function generateVideoWithVeo(
  prompt: string,
  options: VeoGenerateOptions = {}
): Promise<VideoGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('veo', 'mp4')
  
  try {
    if (!env['GEMINI_API_KEY']) {
      throw new Error('GEMINI_API_KEY environment variable is missing')
    }
    
    const model = options.model || 'veo-3.0-generate-preview'
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
    
    l.opts(`${p} [${requestId}] Generating video with model: ${model}`)
    l.dim(`${p} [${requestId}] Prompt: ${prompt}`)
    
    const requestBody: any = {
      instances: [{ prompt }]
    }
    
    if (options.image) {
      l.dim(`${p} [${requestId}] Using image-to-video mode with: ${options.image}`)
      const imageData = await encodeImageToBase64(options.image)
      requestBody.instances[0].image = imageData
    }
    
    const config: VeoGenerateConfig = {}
    if (options.aspectRatio) config.aspectRatio = options.aspectRatio
    if (options.negativePrompt) config.negativePrompt = options.negativePrompt
    if (options.personGeneration) config.personGeneration = options.personGeneration
    
    if (Object.keys(config).length > 0) {
      requestBody.parameters = config
      l.dim(`${p} [${requestId}] Using config: ${JSON.stringify(config)}`)
    }
    
    const submitResponse = await fetch(`${baseUrl}/models/${model}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env['GEMINI_API_KEY']
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      throw new Error(`API error (${submitResponse.status}): ${errorText}`)
    }
    
    const { name: operationName } = await submitResponse.json() as { name: string }
    
    if (!operationName) {
      throw new Error('Invalid response: missing operation name')
    }
    
    l.dim(`${p} [${requestId}] Operation started: ${operationName}`)
    
    const operation = await pollOperation(operationName, env['GEMINI_API_KEY'])
    
    const videoUri = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    
    if (!videoUri) {
      throw new Error('No video URI in response. The video may have been blocked by safety filters.')
    }
    
    ensureOutputDirectory(uniqueOutputPath)
    await downloadVideo(videoUri, env['GEMINI_API_KEY'], uniqueOutputPath)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`${p} [${requestId}] Video generated in ${duration}s: ${uniqueOutputPath}`)
    
    return {
      success: true,
      path: uniqueOutputPath,
      operationName,
      duration: parseFloat(duration)
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`${p} [${requestId}] Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}