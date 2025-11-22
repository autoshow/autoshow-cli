import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureNpmDependencies } from '../image-utils.ts'
import { env } from '@/node-utils'
import type { ImageGenerationResult, BlackForestLabsOptions } from '../image-types'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export async function generateImageWithBlackForestLabs(
  prompt: string, 
  outputPath?: string, 
  options: BlackForestLabsOptions = {}
): Promise<ImageGenerationResult> {
  const startTime = Date.now()
  const uniqueOutputPath = outputPath || generateUniqueFilename('blackforest', 'jpg')
  
  try {
    await ensureNpmDependencies()
    
    if (!env['BFL_API_KEY']) {
      throw new Error('BFL_API_KEY environment variable is missing')
    }
    
    const config = {
      width: 1024,
      height: 768,
      prompt_upsampling: false,
      seed: Math.floor(Math.random() * 1000000),
      safety_tolerance: 2,
      output_format: "jpeg",
      ...options
    }
    
    l.dim(`Submitting generation request`)
    const submitResponse = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Key': env['BFL_API_KEY'] },
      body: JSON.stringify({ prompt, ...config })
    }).catch(error => { 
      throw new Error(`Network error: ${isApiError(error) ? error.message : 'Unknown'}`) 
    })
    
    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({ error: `${submitResponse.status}: ${submitResponse.statusText}` }))
      const errorMap = {
        429: 'Rate limit exceeded: Too many active tasks (limit: 24)',
        402: 'Out of credits. Add more at https://api.us1.bfl.ai'
      }
      throw new Error(errorMap[submitResponse.status as keyof typeof errorMap] || `API error: ${JSON.stringify(errorData)}`)
    }
    
    const { id: taskId } = await submitResponse.json() as { id?: string }
    if (!taskId) {
      throw new Error('Invalid response: missing task ID')
    }
    
    l.dim(`Task ID received: ${taskId}`)
    
    let timeoutId: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Generation timed out after 5 minutes')), 300000)
    })
    
    const imageUrl = await Promise.race([
      (async () => {
        for (let i = 0; i < 120; i++) {
          await sleep(5000)
          const status = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
            headers: { 'X-Key': env['BFL_API_KEY'] || '' }
          }).then(r => r.ok ? r.json() : null).catch(() => null) as any
          
          if (!status) continue
          
          l.dim(`Status check ${i + 1}: ${status.status}`)
          
          if (status.status === 'Ready' && status.result?.sample) {
            if (timeoutId) clearTimeout(timeoutId)
            return status.result.sample
          }
          if (status.status === 'Failed') {
            if (timeoutId) clearTimeout(timeoutId)
            throw new Error(`Generation failed: ${status.details?.error || 'Unknown'}`)
          }
        }
        if (timeoutId) clearTimeout(timeoutId)
        throw new Error('Generation timed out after 10 minutes')
      })(),
      timeoutPromise
    ])
    
    l.dim(`Downloading image from URL`)
    const imageBuffer = await fetch(imageUrl).then(r => {
      if (!r.ok) throw new Error(`Download failed: ${r.status}`)
      return r.arrayBuffer()
    })
    
    await mkdir(dirname(uniqueOutputPath), { recursive: true }).catch(err => {
      if (isApiError(err) && err.code !== 'EEXIST') throw err
    })
    
    await writeFile(uniqueOutputPath, Buffer.from(imageBuffer))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.success(`Generated in ${duration}s: ${uniqueOutputPath}`)
    
    return { success: true, path: uniqueOutputPath, taskId, imageUrl, seed: config.seed }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return { 
      success: false, 
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}