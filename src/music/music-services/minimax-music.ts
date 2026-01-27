import { writeFile } from 'fs/promises'
import { l, success } from '@/logging'
import { 
  generateUniqueFilename, 
  isApiError, 
  ensureOutputDirectory,
  truncateLyricsForMinimax,
  truncatePromptForMinimax,
  normalizeSectionTagsForMinimax,
  getExtensionFromMinimaxFormat,
} from '../music-utils'
import { env } from '@/node-utils'
import type { MusicGenerationResult, MinimaxMusicOptions } from '../music-types'

const BASE_URL = 'https://api.minimax.io/v1/music_generation'

/**
 * MiniMax API error response structure
 */
interface MinimaxApiResponse {
  data?: {
    audio?: string
    status?: number
  }
  base_resp?: {
    status_code: number
    status_msg?: string
  }
  extra_info?: {
    music_duration?: number
    music_sample_rate?: number
    music_channel?: number
    bitrate?: number
    music_size?: number
  }
}

/**
 * Map MiniMax error codes to user-friendly messages
 */
function getMinimaxErrorMessage(code: number, msg?: string): string {
  const errorMap: Record<number, string> = {
    1002: 'Rate limit triggered, retry later',
    1004: 'Authentication failed, check MINIMAX_API_KEY',
    1008: 'Insufficient balance in MiniMax account',
    1026: 'Content flagged for sensitive material',
    2013: 'Invalid parameters, check lyrics and prompt',
    2049: 'Invalid API key',
  }
  return errorMap[code] || msg || `MiniMax API error (code: ${code})`
}

/**
 * Generate music using MiniMax Music 2.5 API
 * 
 * @param options - Music generation options including lyrics (required), prompt, and audio settings
 * @returns Result object with success status, output path, and timing info
 */
export async function generateMusicWithMinimax(
  options: MinimaxMusicOptions
): Promise<MusicGenerationResult> {
  const startTime = Date.now()
  const format = options.audioSetting?.format || 'mp3'
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('minimax-music', format)
  
  try {
    if (!env['MINIMAX_API_KEY']) {
      throw new Error('MINIMAX_API_KEY environment variable is missing')
    }
    
    if (!options.lyrics || options.lyrics.length === 0) {
      throw new Error('Lyrics are required for MiniMax music generation')
    }
    
    l('Generating music with MiniMax Music 2.5')
    
    // Normalize section tags and truncate if needed
    let processedLyrics = normalizeSectionTagsForMinimax(options.lyrics)
    processedLyrics = truncateLyricsForMinimax(processedLyrics)
    
    l('Lyrics', { lyrics: processedLyrics.substring(0, 100) + (processedLyrics.length > 100 ? '...' : '') })
    l('Lyrics length', { length: processedLyrics.length, unit: 'characters' })
    
    const requestBody: Record<string, unknown> = {
      model: 'music-2.5',
      lyrics: processedLyrics,
      output_format: 'url', // Use URL format for simpler handling (no hex decoding)
      audio_setting: {
        sample_rate: options.audioSetting?.sample_rate || 44100,
        bitrate: options.audioSetting?.bitrate || 256000,
        format: options.audioSetting?.format || 'mp3',
      },
    }
    
    if (options.prompt) {
      // Truncate prompt if needed (2000 char limit)
      const truncatedPrompt = truncatePromptForMinimax(options.prompt)
      requestBody['prompt'] = truncatedPrompt
      l('Style', { style: truncatedPrompt.substring(0, 100) + (truncatedPrompt.length > 100 ? '...' : '') })
    }
    
    l('Sending request to MiniMax API...')
    
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env['MINIMAX_API_KEY']}`
      },
      body: JSON.stringify(requestBody)
    })
    
    const result = await response.json() as MinimaxApiResponse
    
    // Check for API errors
    if (result.base_resp?.status_code !== 0) {
      throw new Error(getMinimaxErrorMessage(
        result.base_resp?.status_code ?? -1,
        result.base_resp?.status_msg
      ))
    }
    
    // Check generation status
    if (result.data?.status === 1) {
      // Status 1 means still in progress - shouldn't happen with non-streaming
      throw new Error('Music generation still in progress (unexpected with non-streaming mode)')
    }
    
    const audioUrl = result.data?.audio
    if (!audioUrl) {
      throw new Error('No audio URL in response')
    }
    
    l('Downloading generated audio...')
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const buffer = await audioResponse.arrayBuffer()
    ensureOutputDirectory(uniqueOutputPath)
    await writeFile(uniqueOutputPath, Buffer.from(buffer))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Music generated', { duration, unit: 's', path: uniqueOutputPath })
    
    // Log extra info if available
    if (result.extra_info) {
      const info = result.extra_info
      if (info.music_duration) {
        l('Audio duration', { duration: (info.music_duration / 1000).toFixed(1), unit: 's' })
      }
      if (info.music_size) {
        l('File size', { size: (info.music_size / 1024).toFixed(1), unit: 'KB' })
      }
    }
    
    return {
      success: true,
      path: uniqueOutputPath,
      duration: parseFloat(duration)
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    const errorMessage = isApiError(error) ? error.message : 'Unknown error'
    l('Failed', { duration, unit: 's', error: errorMessage })
    return {
      success: false,
      error: errorMessage,
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}

/**
 * Get the appropriate file extension for MiniMax audio format
 */
export function getMinimaxExtension(options: MinimaxMusicOptions): string {
  return getExtensionFromMinimaxFormat(options.audioSetting?.format || 'mp3')
}
