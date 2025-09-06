import { writeFile } from 'fs/promises'
import RunwayML, { TaskFailedError } from '@runwayml/sdk'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../video-utils.ts'
import { env, readFileSync, existsSync } from '@/node-utils'
import type { VideoGenerationResult, RunwayGenerateOptions } from '@/video/video-types.ts'

const p = '[video/video-services/runway]'

async function downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
  l.dim(`${p} Downloading video from: ${videoUrl}`)
  
  const response = await fetch(videoUrl)
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  await writeFile(outputPath, Buffer.from(buffer))
  l.dim(`${p} Video saved to: ${outputPath}`)
}

async function encodeImageToDataUri(imagePath: string): Promise<string> {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`)
  }
  
  const imageBuffer = readFileSync(imagePath)
  const base64 = imageBuffer.toString('base64')
  
  const ext = imagePath.toLowerCase().split('.').pop()
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  
  return `data:${mimeType};base64,${base64}`
}

function mapAspectRatioToRunway(aspectRatio?: '16:9' | '9:16', model?: string): string {
  if (!aspectRatio || aspectRatio === '16:9') {
    if (model === 'gen3a_turbo') {
      return '1280:768'
    }
    return '1280:720'
  }
  
  if (aspectRatio === '9:16') {
    if (model === 'gen3a_turbo') {
      return '768:1280'
    }
    return '720:1280'
  }
  
  return '1280:720'
}

export async function generateVideoWithRunway(
  prompt: string,
  options: RunwayGenerateOptions = {}
): Promise<VideoGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('runway', 'mp4')
  
  try {
    if (!env['RUNWAYML_API_SECRET']) {
      throw new Error('RUNWAYML_API_SECRET environment variable is missing')
    }
    
    if (!options.image) {
      throw new Error('Image is required for Runway video generation. Please provide an image using the --image option.')
    }
    
    const client = new RunwayML({
      apiKey: env['RUNWAYML_API_SECRET']
    })
    
    const model = options.model || 'gen4_turbo'
    
    l.opts(`${p} [${requestId}] Generating video with model: ${model}`)
    l.dim(`${p} [${requestId}] Prompt: ${prompt}`)
    l.dim(`${p} [${requestId}] Image: ${options.image}`)
    
    const ratio = mapAspectRatioToRunway(options.aspectRatio, model)
    const duration = options.duration || 5
    
    if (duration !== 5 && duration !== 10) {
      throw new Error('Duration must be either 5 or 10 seconds')
    }
    
    l.dim(`${p} [${requestId}] Using aspect ratio: ${ratio}, duration: ${duration}s`)
    
    let promptImage: string
    
    if (options.image.startsWith('http://') || options.image.startsWith('https://')) {
      promptImage = options.image
    } else {
      promptImage = await encodeImageToDataUri(options.image)
    }
    
    l.dim(`${p} [${requestId}] Starting video generation task...`)
    
    const task = await client.imageToVideo
      .create({
        model: model as any,
        promptImage,
        promptText: prompt,
        ratio: ratio as any,
        duration: duration as 5 | 10,
      })
      .waitForTaskOutput({
        timeout: 10 * 60 * 1000
      })
    
    l.dim(`${p} [${requestId}] Task completed successfully`)
    
    if (!task.output || task.output.length === 0) {
      throw new Error('No video output in response')
    }
    
    const videoUrl = task.output[0]
    
    if (!videoUrl) {
      throw new Error('No video URL in response')
    }
    
    ensureOutputDirectory(uniqueOutputPath)
    await downloadVideo(videoUrl, uniqueOutputPath)
    
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`${p} [${requestId}] Video generated in ${durationSeconds}s: ${uniqueOutputPath}`)
    
    return {
      success: true,
      path: uniqueOutputPath,
      operationName: task.id,
      duration: parseFloat(durationSeconds)
    }
  } catch (error) {
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
    
    if (error instanceof TaskFailedError) {
      l.warn(`${p} [${requestId}] Task failed in ${durationSeconds}s: ${error.message}`)
      return {
        success: false,
        error: 'Video generation task failed',
        details: JSON.stringify(error.taskDetails)
      }
    }
    
    l.warn(`${p} [${requestId}] Failed in ${durationSeconds}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}