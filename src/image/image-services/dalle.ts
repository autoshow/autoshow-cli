import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { l } from '../../text/utils/logging.ts'
import { generateUniqueFilename, isApiError } from '../image-utils.ts'
import { env } from '../../text/utils/node-utils.ts'
import type { ImageGenerationResult } from '../../text/utils/types.ts'

export async function generateImageWithDallE(
  prompt: string, 
  outputPath?: string
): Promise<ImageGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('dalle', 'png')
  
  l.dim(`[${requestId}] Starting DALL-E | Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}" | Path: ${uniqueOutputPath}`)
  
  try {
    if (!env['OPENAI_API_KEY']) {
      throw new Error('OPENAI_API_KEY environment variable is missing')
    }
    
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
    
    l.dim(`[${requestId}] Response: ${response.status}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `${response.status}: ${response.statusText}` }))
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`)
    }
    
    const { data } = await response.json() as { data?: { b64_json?: string; revised_prompt?: string }[] }
    const imageData = data?.[0]?.b64_json
    
    if (!imageData) {
      throw new Error('Invalid response format')
    }
    
    l.dim(`[${requestId}] Image received (${imageData.length} chars)`)
    
    await mkdir(dirname(uniqueOutputPath), { recursive: true }).catch(err => {
      if (isApiError(err) && err.code !== 'EEXIST') throw err
    })
    
    await writeFile(uniqueOutputPath, Buffer.from(imageData, 'base64'))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`[${requestId}] ✓ Success in ${duration}s - ${uniqueOutputPath}`)
    
    return { 
      success: true, 
      path: uniqueOutputPath, 
      prompt_used: data?.[0]?.revised_prompt || prompt 
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.dim(`[${requestId}] ✗ Failed in ${duration}s - ${isApiError(error) ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}