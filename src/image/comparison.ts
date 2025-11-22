import { l } from '@/logging'
import { isApiError } from './image-utils.ts'
import { env } from '@/node-utils'
import { generateImageWithDallE } from './image-services/dalle.ts'
import { generateImageWithBlackForestLabs } from './image-services/bfl.ts'
import { generateImageWithNova } from './image-services/nova.ts'
import { generateImageWithRunway } from './image-services/runway.ts'

export async function generateComparisonImages(prompt: string): Promise<any> {
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
    
    if (env['RUNWAYML_API_SECRET']) {
      promises.push(generateImageWithRunway(prompt, undefined))
    }
    
    if (!promises.length) {
      throw new Error('No API keys configured for comparison')
    }
    
    l.opts(`Running ${promises.length} parallel generations`)
    const results = await Promise.allSettled(promises)
    
    const comparison: any = { prompt }
    let resultIndex = 0
    
    if (env['OPENAI_API_KEY']) {
      const result = results[resultIndex]
      comparison.dalle = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.dalle) {
        l.warn(`DALL-E failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
      resultIndex++
    }
    
    if (env['BFL_API_KEY']) {
      const result = results[resultIndex]
      comparison.blackForest = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.blackForest) {
        l.warn(`Black Forest Labs failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
      resultIndex++
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      const result = results[resultIndex]
      comparison.nova = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.nova) {
        l.warn(`Nova Canvas failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
      resultIndex++
    }
    
    if (env['RUNWAYML_API_SECRET']) {
      const result = results[resultIndex]
      comparison.runway = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.runway) {
        l.warn(`Runway failed: ${result && result.status === 'rejected' ? result.reason : 'Unknown'}`)
      }
    }
    
    l.success(`Comparison complete`)
    return comparison
  } catch (error) {
    l.warn(`Comparison error: ${isApiError(error) ? error.message : 'Unknown error'}`)
    
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error', 
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace available' 
    }
  }
}