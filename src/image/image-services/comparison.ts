import { l } from '@/logging'
import { isApiError } from '../image-utils.ts'
import { env } from '@/node-utils'
import { generateImageWithDallE } from './dalle.ts'
import { generateImageWithBlackForestLabs } from './bfl.ts'
import { generateImageWithNova } from './nova.ts'

export async function generateComparisonImages(prompt: string): Promise<any> {
  const p = '[image/image-services/comparison]'
  const requestId = Math.random().toString(36).substring(2, 10)
  l.dim(`${p} [${requestId}] Starting comparison generation`)
  l.dim(`${p} [${requestId}] Comparing services with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`)
  
  try {
    const promises = []
    
    if (env['OPENAI_API_KEY']) {
      l.dim(`${p} [${requestId}] Adding DALL-E to comparison`)
      promises.push(generateImageWithDallE(prompt, undefined))
    }
    
    if (env['BFL_API_KEY']) {
      l.dim(`${p} [${requestId}] Adding Black Forest Labs to comparison`)
      promises.push(generateImageWithBlackForestLabs(prompt, undefined))
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      l.dim(`${p} [${requestId}] Adding Nova Canvas to comparison`)
      promises.push(generateImageWithNova(prompt, { resolution: '1024x1024', quality: 'standard' }))
    }
    
    if (!promises.length) {
      throw new Error('No API keys configured for comparison')
    }
    
    l.dim(`${p} [${requestId}] Running ${promises.length} parallel generations...`)
    const results = await Promise.allSettled(promises)
    
    const comparison: any = { prompt }
    let resultIndex = 0
    
    if (env['OPENAI_API_KEY']) {
      const result = results[resultIndex]
      if (result && result.status === 'fulfilled') {
        comparison.dalle = result.value
        l.dim(`${p} [${requestId}] DALL-E 3 Result: Success - ${result.value.path}`)
      } else {
        comparison.dalle = null
        l.dim(`${p} [${requestId}] DALL-E 3 Result: Failed - ${result ? result.reason : 'No result'}`)
      }
      resultIndex++
    }
    
    if (env['BFL_API_KEY']) {
      const result = results[resultIndex]
      if (result && result.status === 'fulfilled') {
        comparison.blackForest = result.value
        l.dim(`${p} [${requestId}] Black Forest Labs Result: Success - ${result.value.path}`)
      } else {
        comparison.blackForest = null
        l.dim(`${p} [${requestId}] Black Forest Labs Result: Failed - ${result ? result.reason : 'No result'}`)
      }
      resultIndex++
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      const result = results[resultIndex]
      if (result && result.status === 'fulfilled') {
        comparison.nova = result.value
        l.dim(`${p} [${requestId}] AWS Nova Canvas Result: Success - ${result.value.path}`)
      } else {
        comparison.nova = null
        l.dim(`${p} [${requestId}] AWS Nova Canvas Result: Failed - ${result ? result.reason : 'No result'}`)
      }
    }
    
    l.success(`${p} [${requestId}] Comparison complete`)
    return comparison
  } catch (error) {
    l.dim(`${p} [${requestId}] ERROR in comparison generation: ${isApiError(error) ? error.message : 'Unknown error'}`)
    
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error', 
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace available' 
    }
  }
}