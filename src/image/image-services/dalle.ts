import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { l, success } from '@/logging'
import { generateUniqueFilename, isApiError, ensureDependencies } from '../image-utils'
import { env } from '@/node-utils'
import type { ImageGenerationResult } from '../image-types'

export async function generateImageWithDallE(
  prompt: string, 
  outputPath?: string
): Promise<ImageGenerationResult> {
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('dalle', 'png')
  
  try {
    await ensureDependencies()
    
    if (!env['OPENAI_API_KEY']) {
      throw new Error('OPENAI_API_KEY environment variable is missing')
    }
    
    l('Sending request to OpenAI API')
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${env['OPENAI_API_KEY']}` 
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json'
      })
    }).catch(error => { 
      throw new Error(`Network error: ${isApiError(error) ? error.message : 'Unknown'}`) 
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `${response.status}: ${response.statusText}` }))
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`)
    }
    
    const { data } = await response.json() as { data?: { b64_json?: string; revised_prompt?: string }[] }
    const imageData = data?.[0]?.b64_json
    
    if (!imageData) {
      throw new Error('Invalid response format')
    }
    
    l('Image data received, saving to file')
    await mkdir(dirname(uniqueOutputPath), { recursive: true }).catch(err => {
      if (isApiError(err) && err.code !== 'EEXIST') throw err
    })
    
    await writeFile(uniqueOutputPath, Buffer.from(imageData, 'base64'))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Generated', { duration: `${duration}s`, path: uniqueOutputPath })
    
    return { 
      success: true, 
      path: uniqueOutputPath, 
      prompt_used: data?.[0]?.revised_prompt || prompt 
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