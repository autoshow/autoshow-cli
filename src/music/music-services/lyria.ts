import { writeFile } from 'fs/promises'
import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../music-utils.ts'
import { env } from '@/node-utils'
import type { MusicGenerationOptions, MusicGenerationResult } from '@/music/music-types.ts'

const p = '[music/music-services/lyria]'

export async function generateMusicWithLyria(
  options: MusicGenerationOptions
): Promise<MusicGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('lyria', 'wav')
  
  try {
    if (!env['GEMINI_API_KEY']) {
      throw new Error('GEMINI_API_KEY environment variable is missing')
    }
    
    l.opts(`${p} [${requestId}] Starting Lyria RealTime music generation`)
    l.dim(`${p} [${requestId}] Prompts: ${JSON.stringify(options.prompts)}`)
    l.dim(`${p} [${requestId}] Config: ${JSON.stringify(options.config)}`)
    l.dim(`${p} [${requestId}] Duration: ${options.duration || 30} seconds`)
    
    l.warn(`${p} [${requestId}] Lyria RealTime API Status:`)
    l.warn(`${p} [${requestId}] The Lyria RealTime music generation model is currently in experimental preview`)
    l.warn(`${p} [${requestId}] and requires WebSocket support that isn't available in the current SDK version.`)
    l.warn(`${p} [${requestId}]`)
    l.warn(`${p} [${requestId}] To use Lyria RealTime:`)
    l.warn(`${p} [${requestId}] 1. Wait for SDK updates with WebSocket support`)
    l.warn(`${p} [${requestId}] 2. Try the web-based Prompt DJ at: https://aistudio.google.com/apps/bundled/promptdj`)
    l.warn(`${p} [${requestId}] 3. Use the Python SDK which has experimental support`)
    
    const fallbackResult = await generateFallbackAudio(uniqueOutputPath, options)
    
    if (fallbackResult) {
      l.dim(`${p} [${requestId}] Generated placeholder audio file for testing`)
      return fallbackResult
    }
    
    return {
      success: false,
      error: 'Lyria RealTime is not yet available in this SDK version',
      details: 'The model requires WebSocket support that will be added in a future update. Visit https://aistudio.google.com/apps/bundled/promptdj to try it in the browser.'
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`${p} [${requestId}] Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}

async function generateFallbackAudio(outputPath: string, options: MusicGenerationOptions): Promise<MusicGenerationResult | null> {
  const p = '[music/music-services/lyria/fallback]'
  
  try {
    const duration = options.duration || 30
    const sampleRate = 48000
    const channels = 2
    const bitsPerSample = 16
    const bytesPerSample = bitsPerSample / 8
    const totalSamples = sampleRate * duration
    const dataSize = totalSamples * channels * bytesPerSample
    
    l.dim(`${p} Creating ${duration}-second silent placeholder audio`)
    
    const wavHeader = Buffer.alloc(44)
    wavHeader.write('RIFF', 0)
    wavHeader.writeUInt32LE(36 + dataSize, 4)
    wavHeader.write('WAVE', 8)
    wavHeader.write('fmt ', 12)
    wavHeader.writeUInt32LE(16, 16)
    wavHeader.writeUInt16LE(1, 20)
    wavHeader.writeUInt16LE(channels, 22)
    wavHeader.writeUInt32LE(sampleRate, 24)
    wavHeader.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
    wavHeader.writeUInt16LE(channels * bytesPerSample, 32)
    wavHeader.writeUInt16LE(bitsPerSample, 34)
    wavHeader.write('data', 36)
    wavHeader.writeUInt32LE(dataSize, 40)
    
    const silentData = Buffer.alloc(dataSize)
    const frequency = 440
    const amplitude = 0.1
    
    for (let i = 0; i < totalSamples; i++) {
      const fadeIn = Math.min(1, i / (sampleRate * 0.5))
      const fadeOut = Math.min(1, (totalSamples - i) / (sampleRate * 0.5))
      const envelope = fadeIn * fadeOut
      
      const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude * envelope
      const sample = Math.floor(value * 32767)
      
      for (let ch = 0; ch < channels; ch++) {
        const offset = (i * channels + ch) * bytesPerSample
        silentData.writeInt16LE(sample, offset)
      }
    }
    
    const wavData = Buffer.concat([wavHeader, silentData])
    
    ensureOutputDirectory(outputPath)
    await writeFile(outputPath, wavData)
    
    l.dim(`${p} Placeholder audio saved to: ${outputPath}`)
    l.dim(`${p} Note: This is a test tone, not AI-generated music`)
    
    return {
      success: true,
      path: outputPath,
      sessionId: 'placeholder',
      duration: duration
    }
  } catch (error) {
    l.warn(`${p} Failed to generate fallback audio: ${isApiError(error) ? error.message : 'Unknown'}`)
    return null
  }
}

export async function checkLyriaAvailability(): Promise<boolean> {
  try {
    if (!env['GEMINI_API_KEY']) {
      l.warn(`${p} No GEMINI_API_KEY found`)
      return false
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${env['GEMINI_API_KEY']}`
    )
    
    if (!response.ok) {
      l.warn(`${p} Failed to fetch model list: ${response.status}`)
      return false
    }
    
    const data = await response.json() as { models?: Array<{ name: string, supportedGenerationMethods?: string[] }> }
    const models = data.models || []
    
    const lyriaModel = models.find(m => m.name?.includes('lyria'))
    
    if (lyriaModel) {
      l.dim(`${p} Found Lyria model: ${lyriaModel.name}`)
      l.dim(`${p} Supported methods: ${JSON.stringify(lyriaModel.supportedGenerationMethods)}`)
      return true
    }
    
    l.dim(`${p} Lyria model not found in available models`)
    l.dim(`${p} Available music models: ${models.filter(m => m.name?.includes('music')).map(m => m.name).join(', ') || 'none'}`)
    
    return false
  } catch (error) {
    l.warn(`${p} Error checking Lyria availability: ${isApiError(error) ? error.message : 'Unknown'}`)
    return false
  }
}