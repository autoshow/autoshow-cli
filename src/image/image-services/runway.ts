import { writeFile } from 'fs/promises'
import RunwayML from '@runwayml/sdk'
import { l, success } from '@/logging'
import { generateUniqueFilename, isApiError, ensureDependencies } from '../image-utils'
import { env } from '@/node-utils'
import type { ImageGenerationResult, RunwayImageOptions } from '../image-types'

async function downloadImage(imageUrl: string, outputPath: string): Promise<void> {
  const response = await fetch(imageUrl)
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  await writeFile(outputPath, Buffer.from(buffer))
}

export async function generateImageWithRunway(
  prompt: string,
  outputPath?: string,
  options: RunwayImageOptions = {}
): Promise<ImageGenerationResult> {
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('runway', 'jpg')
  
  try {
    await ensureDependencies()
    
    if (!env['RUNWAYML_API_SECRET']) {
      throw new Error('RUNWAYML_API_SECRET environment variable is missing')
    }
    
    const client = new RunwayML({
      apiKey: env['RUNWAYML_API_SECRET']
    })
    
    l('Generating image with Runway')
    l('Prompt', { prompt })
    
    let ratio = '1024:1024'
    if (options.width && options.height) {
      ratio = `${options.width}:${options.height}`
    }
    
    let validModel = 'gen4_image'
    if (options.model === 'gen4_image_turbo') {
      l('Note: gen4_image_turbo requires reference images. Using gen4_image instead for text-to-image.')
      validModel = 'gen4_image'
    } else if (options.model === 'gen4_image') {
      validModel = 'gen4_image'
    }
    
    const config: any = {
      promptText: prompt,
      ratio,
      model: validModel
    }
    
    l('Using model', { model: validModel })
    l('Using ratio', { ratio })
    
    if (options.style) {
      config.style = options.style
      l('Using style', { style: options.style })
    }
    
    l('Starting image generation task with config', { config })
    
    const task = await client.textToImage
      .create(config)
      .waitForTaskOutput({
        timeout: 5 * 60 * 1000
      })
    
    l('Task completed successfully')
    l('Task ID', { taskId: task.id })
    
    if (!task.output || task.output.length === 0) {
      throw new Error('No image output in response')
    }
    
    const imageUrl = task.output[0]
    
    if (!imageUrl) {
      throw new Error('No image URL in response')
    }
    
    l('Downloading image from URL', { url: imageUrl })
    await downloadImage(imageUrl, uniqueOutputPath)
    l('Image saved', { path: uniqueOutputPath })
    
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Image generated', { duration: `${durationSeconds}s`, path: uniqueOutputPath })
    
    return {
      success: true,
      path: uniqueOutputPath,
      taskId: task.id
    }
  } catch (error: any) {
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
    
    l('Error occurred', { name: error.name })
    l('Error status', { status: error.status })
    l('Error message', { message: error.message })
    
    if (error.name === 'TaskFailedError') {
      l('Task failed', { duration: `${durationSeconds}s`, message: error.message })
      return {
        success: false,
        error: 'Image generation task failed',
        details: JSON.stringify(error.taskDetails)
      }
    }
    
    if (error.status === 403) {
      const errorMsg = error.error?.error || error.message
      l('Permission denied', { duration: `${durationSeconds}s`, message: errorMsg })
      
      if (errorMsg?.includes('not available')) {
        return {
          success: false,
          error: 'Text-to-image may not be available on your Runway account or the specified model is not accessible',
          details: 'Please check your Runway account permissions and available features at https://app.runwayml.com'
        }
      }
      
      return {
        success: false,
        error: `Permission denied: ${errorMsg}`,
        details: 'Check your API key permissions and account features'
      }
    }
    
    if (error.status === 400) {
      const errorMsg = error.error?.error || error.message
      l('Bad request', { duration: `${durationSeconds}s`, message: errorMsg })
      
      if (errorMsg?.includes('ratio')) {
        return {
          success: false,
          error: 'Invalid aspect ratio. Use standard ratios like 1024:1024, 1280:720, 720:1280',
          details: errorMsg
        }
      }
      
      if (errorMsg?.includes('model')) {
        return {
          success: false,
          error: 'Invalid model. Valid models are: gen4_image (for text-to-image), gen4_image_turbo (requires reference images)',
          details: errorMsg
        }
      }
      
      if (errorMsg?.includes('referenceImages')) {
        return {
          success: false,
          error: 'gen4_image_turbo requires reference images. Use gen4_image for text-to-image generation without references.',
          details: errorMsg
        }
      }
      
      return {
        success: false,
        error: `Bad request: ${errorMsg}`,
        details: 'Check your parameters and try again'
      }
    }
    
    l('Failed', { duration: `${durationSeconds}s`, error: isApiError(error) ? error.message : 'Unknown' })
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}