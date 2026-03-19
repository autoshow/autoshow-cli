import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import OpenAI from 'openai'
import { l, success } from '@/logging'
import { generateUniqueFilename, isApiError, ensureDependencies } from '../image-utils'
import { env } from '@/node-utils'
import type { ImageGenerationResult, ChatGPTImageModel } from '../image-types'

export async function generateImageWithChatGPT(
  prompt: string, 
  outputPath?: string,
  model: ChatGPTImageModel = 'gpt-image-1.5'
): Promise<ImageGenerationResult> {
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename(model, 'png')
  
  try {
    await ensureDependencies()
    
    if (!env['OPENAI_API_KEY']) {
      throw new Error('OPENAI_API_KEY environment variable is missing')
    }
    
    const openai = new OpenAI({ apiKey: env['OPENAI_API_KEY'] })
    
    l('Sending request to OpenAI API', { model })
    const result = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: '1024x1024'
    })
    
    const imageBase64 = result.data?.[0]?.b64_json
    if (!imageBase64) {
      throw new Error('Invalid response format: missing image data')
    }
    
    l('Image data received, saving to file')
    await mkdir(dirname(uniqueOutputPath), { recursive: true }).catch(err => {
      if (isApiError(err) && err.code !== 'EEXIST') throw err
    })
    
    await writeFile(uniqueOutputPath, Buffer.from(imageBase64, 'base64'))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Generated', { duration: `${duration}s`, path: uniqueOutputPath })
    
    return { 
      success: true, 
      path: uniqueOutputPath, 
      prompt_used: prompt 
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l('Failed', { duration: `${duration}s`, error: isApiError(error) ? error.message : 'Unknown' })
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}
