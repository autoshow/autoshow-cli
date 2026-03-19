import { l, success } from '@/logging'
import { isApiError } from './image-utils'
import { env } from '@/node-utils'
import { generateImageWithChatGPT } from './image-services/chatgpt-image'
import { generateImageWithBlackForestLabs } from './image-services/bfl'
import { generateImageWithNova } from './image-services/nova'
import { generateImageWithRunway } from './image-services/runway'

export async function generateComparisonImages(prompt: string): Promise<any> {
  try {
    const promises = []
    
    if (env['OPENAI_API_KEY']) {
      promises.push(generateImageWithChatGPT(prompt, undefined, 'gpt-image-1'))
      promises.push(generateImageWithChatGPT(prompt, undefined, 'gpt-image-1.5'))
      promises.push(generateImageWithChatGPT(prompt, undefined, 'gpt-image-1-mini'))
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
    
    l('Running parallel generations', { count: promises.length })
    const results = await Promise.allSettled(promises)
    
    const comparison: any = { prompt }
    let resultIndex = 0
    
    if (env['OPENAI_API_KEY']) {
      const result1 = results[resultIndex]
      comparison.chatgptImage1 = result1 && result1.status === 'fulfilled' ? result1.value : null
      if (!comparison.chatgptImage1) {
        l('ChatGPT Image 1 failed', { reason: result1 && result1.status === 'rejected' ? result1.reason : 'Unknown' })
      }
      resultIndex++
      
      const result1_5 = results[resultIndex]
      comparison.chatgptImage1_5 = result1_5 && result1_5.status === 'fulfilled' ? result1_5.value : null
      if (!comparison.chatgptImage1_5) {
        l('ChatGPT Image 1.5 failed', { reason: result1_5 && result1_5.status === 'rejected' ? result1_5.reason : 'Unknown' })
      }
      resultIndex++
      
      const resultMini = results[resultIndex]
      comparison.chatgptImageMini = resultMini && resultMini.status === 'fulfilled' ? resultMini.value : null
      if (!comparison.chatgptImageMini) {
        l('ChatGPT Image 1 Mini failed', { reason: resultMini && resultMini.status === 'rejected' ? resultMini.reason : 'Unknown' })
      }
      resultIndex++
    }
    
    if (env['BFL_API_KEY']) {
      const result = results[resultIndex]
      comparison.blackForest = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.blackForest) {
        l('Black Forest Labs failed', { reason: result && result.status === 'rejected' ? result.reason : 'Unknown' })
      }
      resultIndex++
    }
    
    if (env['AWS_ACCESS_KEY_ID'] && env['AWS_SECRET_ACCESS_KEY']) {
      const result = results[resultIndex]
      comparison.nova = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.nova) {
        l('Nova Canvas failed', { reason: result && result.status === 'rejected' ? result.reason : 'Unknown' })
      }
      resultIndex++
    }
    
    if (env['RUNWAYML_API_SECRET']) {
      const result = results[resultIndex]
      comparison.runway = result && result.status === 'fulfilled' ? result.value : null
      if (!comparison.runway) {
        l('Runway failed', { reason: result && result.status === 'rejected' ? result.reason : 'Unknown' })
      }
    }
    
    success('Comparison complete')
    return comparison
  } catch (error) {
    l('Comparison error', { error: isApiError(error) ? error.message : 'Unknown error' })
    
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error', 
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace available' 
    }
  }
}