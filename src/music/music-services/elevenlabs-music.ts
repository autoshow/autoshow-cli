import { writeFile } from 'fs/promises'
import { l, success } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory, getExtensionFromFormat } from '../music-utils'
import { env } from '@/node-utils'
import type { 
  MusicGenerationResult, 
  MusicGenerateOptions, 
  MusicPlanResult,
  MusicPlanOptions,
  MusicCompositionPlan
} from '../music-types'

const BASE_URL = 'https://api.elevenlabs.io/v1/music'

export async function generateMusicWithElevenLabs(
  prompt: string,
  options: MusicGenerateOptions = {}
): Promise<MusicGenerationResult> {
  const startTime = Date.now()
  const extension = getExtensionFromFormat(options.outputFormat || 'mp3_44100_128')
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('elevenlabs-music', extension)
  
  try {
    if (!env['ELEVENLABS_API_KEY']) {
      throw new Error('ELEVENLABS_API_KEY environment variable is missing')
    }
    
    l('Generating music with ElevenLabs')
    l('Prompt', { prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '') })
    
    const requestBody: Record<string, any> = {
      model_id: 'music_v1'
    }
    
    if (options.compositionPlan) {
      requestBody['composition_plan'] = options.compositionPlan
      if (options.respectSectionDurations !== undefined) {
        requestBody['respect_sections_durations'] = options.respectSectionDurations
      }
    } else {
      let fullPrompt = prompt
      if (options.lyrics) {
        fullPrompt = `${prompt}\n\nLyrics:\n${options.lyrics}`
      }
      requestBody['prompt'] = fullPrompt
      
      if (options.durationMs) {
        requestBody['music_length_ms'] = options.durationMs
        l('Duration', { durationMs: options.durationMs, unit: 'ms' })
      }
      if (options.instrumental) {
        requestBody['force_instrumental'] = true
        l('Mode: Instrumental only')
      }
    }
    
    if (options.signWithC2pa) {
      requestBody['sign_with_c2pa'] = true
    }
    
    const url = new URL(BASE_URL)
    if (options.outputFormat) {
      url.searchParams.set('output_format', options.outputFormat)
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env['ELEVENLABS_API_KEY']
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error (${response.status}): ${errorText}`)
    }
    
    const songId = response.headers.get('x-song-id') || undefined
    
    const buffer = await response.arrayBuffer()
    ensureOutputDirectory(uniqueOutputPath)
    await writeFile(uniqueOutputPath, Buffer.from(buffer))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Music generated', { duration, unit: 's', path: uniqueOutputPath })
    
    return {
      success: true,
      path: uniqueOutputPath,
      songId,
      duration: parseFloat(duration)
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l('Failed', { duration, unit: 's', error: isApiError(error) ? error.message : 'Unknown' })
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}

export async function generateMusicDetailedWithElevenLabs(
  prompt: string,
  options: MusicGenerateOptions = {}
): Promise<MusicGenerationResult> {
  const startTime = Date.now()
  const extension = getExtensionFromFormat(options.outputFormat || 'mp3_44100_128')
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('elevenlabs-music', extension)
  
  try {
    if (!env['ELEVENLABS_API_KEY']) {
      throw new Error('ELEVENLABS_API_KEY environment variable is missing')
    }
    
    l('Generating music with ElevenLabs (detailed response)')
    l('Prompt', { prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '') })
    
    const requestBody: Record<string, any> = {
      model_id: 'music_v1',
      with_timestamps: options.withTimestamps || false
    }
    
    if (options.compositionPlan) {
      requestBody['composition_plan'] = options.compositionPlan
    } else {
      let fullPrompt = prompt
      if (options.lyrics) {
        fullPrompt = `${prompt}\n\nLyrics:\n${options.lyrics}`
      }
      requestBody['prompt'] = fullPrompt
      
      if (options.durationMs) {
        requestBody['music_length_ms'] = options.durationMs
      }
      if (options.instrumental) {
        requestBody['force_instrumental'] = true
      }
    }
    
    if (options.signWithC2pa) {
      requestBody['sign_with_c2pa'] = true
    }
    
    const url = new URL(`${BASE_URL}/detailed`)
    if (options.outputFormat) {
      url.searchParams.set('output_format', options.outputFormat)
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env['ELEVENLABS_API_KEY']
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error (${response.status}): ${errorText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    let songId: string | undefined
    let timestamps: any
    
    const buffer = await response.arrayBuffer()
    ensureOutputDirectory(uniqueOutputPath)
    await writeFile(uniqueOutputPath, Buffer.from(buffer))
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    success('Music generated', { duration, unit: 's', path: uniqueOutputPath })
    l('Content-Type', { contentType })
    
    return {
      success: true,
      path: uniqueOutputPath,
      songId,
      timestamps,
      duration: parseFloat(duration)
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l('Failed', { duration, unit: 's', error: isApiError(error) ? error.message : 'Unknown' })
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}

export async function createCompositionPlan(
  prompt: string,
  options: MusicPlanOptions = {}
): Promise<MusicPlanResult> {
  try {
    if (!env['ELEVENLABS_API_KEY']) {
      throw new Error('ELEVENLABS_API_KEY environment variable is missing')
    }
    
    l('Creating composition plan with ElevenLabs')
    l('Prompt', { prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '') })
    
    const requestBody: Record<string, any> = {
      prompt,
      model_id: 'music_v1'
    }
    
    if (options.durationMs) {
      requestBody['music_length_ms'] = options.durationMs
    }
    
    if (options.sourceCompositionPlan) {
      requestBody['source_composition_plan'] = options.sourceCompositionPlan
    }
    
    const response = await fetch(`${BASE_URL}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env['ELEVENLABS_API_KEY']
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error (${response.status}): ${errorText}`)
    }
    
    const plan = await response.json() as MusicCompositionPlan
    
    success('Composition plan created successfully')
    l('Sections', { count: plan.sections?.length || 0 })
    
    return {
      success: true,
      plan
    }
  } catch (error) {
    l('Failed', { error: isApiError(error) ? error.message : 'Unknown' })
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}
