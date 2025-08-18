import { l } from '@/logging'
import { isApiError } from '../image-utils.ts'
import { env } from '@/node-utils'
import { generateImageWithDallE } from './dalle.ts'
import { generateImageWithBlackForestLabs } from './bfl.ts'
import { generateImageWithNova } from './nova.ts'

export async function generateComparisonImages(prompt: string): Promise<any> {
  const p = '[image/image-services/comparison]'
  const requestId = Math.random().toString(36).substring(2, 10)
  
  try {
    const promises = []
    
    if (env['OPENAI_API_KEY']) {
      promises.push(generateImageWithDallE(prompt, undefined))
    }
    
    if (env['BFL_API_KEY']) {
      promises.push(generateImageWithBlackForestLabs(prompt, undefined))
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      promises.push(generateImageWithNova(prompt, { resolution: '1024x1024', quality: 'standard' }))
    }
    
    if (!promises.length) {
      throw new Error('No API keys configured for comparison')
    }
    
    l.opts(`${p} [${requestId}] Running ${promises.length} parallel generations`)
    const results = await Promise.allSettled(promises)
    
    const comparison: any = { prompt }
    let resultIndex = 0
    
    if (env['OPENAI_API_KEY']) {
      const result = results[resultIndex]
      comparison.dalle = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.dalle) {
        l.warn(`${p} [${requestId}] DALL-E failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
      resultIndex++
    }
    
    if (env['BFL_API_KEY']) {
      const result = results[resultIndex]
      comparison.blackForest = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.blackForest) {
        l.warn(`${p} [${requestId}] Black Forest Labs failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
      resultIndex++
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      const result = results[resultIndex]
      comparison.nova = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.nova) {
        l.warn(`${p} [${requestId}] Nova Canvas failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
    }
    
    l.success(`${p} [${requestId}] Comparison complete`)
    return comparison
  } catch (error) {
    l.warn(`${p} [${requestId}] Comparison error: ${isApiError(error) ? error.message : 'Unknown error'}`)
    
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error', 
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace available' 
    }
  }
}