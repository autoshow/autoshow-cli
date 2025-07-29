// src/transcription/groq-whisper.ts

import { l, err } from '../../logging.ts'
import { readFile, env } from '../../node-utils.ts'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../process-steps/03-run-transcription.ts'
import type { ProcessingOptions } from '@/types.ts'

export async function callGroqWhisper(
  options: ProcessingOptions,
  finalPath: string
) {
  l.dim('\n  callGroqWhisper called with arguments:')
  l.dim(`    - finalPath: ${finalPath}`)
  
  if (!env['GROQ_API_KEY']) {
    throw new Error('GROQ_API_KEY environment variable is not set. Please set it to your Groq API key.')
  }
  
  try {
    const defaultGroqWhisperModel = TRANSCRIPTION_SERVICES_CONFIG.groqWhisper.models.find(m => m.modelId === 'whisper-large-v3-turbo')?.modelId || 'whisper-large-v3-turbo'
    const groqWhisperModel = typeof options.groqWhisper === 'string'
      ? options.groqWhisper
      : defaultGroqWhisperModel
    
    const modelInfo =
      TRANSCRIPTION_SERVICES_CONFIG.groqWhisper.models.find(m => m.modelId.toLowerCase() === groqWhisperModel.toLowerCase())
      || TRANSCRIPTION_SERVICES_CONFIG.groqWhisper.models.find(m => m.modelId === 'whisper-large-v3-turbo')
    
    if (!modelInfo) {
      throw new Error(`Model information for model ${groqWhisperModel} is not defined.`)
    }
    
    const { modelId, costPerMinuteCents } = modelInfo
    const audioFilePath = `${finalPath}.wav`
    const audioBuffer = await readFile(audioFilePath)
    
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer]), 'audio.wav')
    formData.append('model', modelId)
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')
    
    if (options.speakerLabels) {
      formData.append('temperature', '0.3')
    } else {
      formData.append('temperature', '0')
    }
    
    l.dim(`  Making Groq API request with model: ${modelId}`)
    
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env['GROQ_API_KEY']}`,
      },
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`Groq API request failed with status ${response.status}: ${await response.text()}`)
    }
    
    const result = await response.json()
    l.dim(`  Received response from Groq API`)
    
    let txtContent = ''
    
    if (result.segments && Array.isArray(result.segments)) {
      txtContent = result.segments.map((segment: any) => {
        const timestamp = formatTimestamp(segment.start)
        return `[${timestamp}] ${segment.text}`
      }).join('\n')
    } else if (result.text) {
      txtContent = result.text
    } else {
      throw new Error('No transcription results found in Groq response')
    }
    
    return {
      transcript: txtContent,
      modelId,
      costPerMinuteCents
    }
  } catch (error) {
    err(`Error processing the transcription with Groq: ${(error as Error).message}`)
    throw error
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}