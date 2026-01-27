import { err } from '@/logging'
import { readFile, env } from '@/node-utils'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../transcription-models'
import type { ProcessingOptions, DeepgramWord } from '@/text/text-types'

export function formatDeepgramTranscript(
  words: DeepgramWord[],
  speakerLabels: boolean
): string {
  if (!speakerLabels) {
    return words.map(w => w.word).join(' ')
  }

  let transcript = ''
  let currentSpeaker = words.length > 0 && words[0] ? words[0].speaker ?? undefined : undefined
  let speakerWords: string[] = []

  for (const w of words) {
    if (w.speaker !== currentSpeaker) {
      transcript += `Speaker ${currentSpeaker}: ${speakerWords.join(' ')}\n\n`
      currentSpeaker = w.speaker
      speakerWords = []
    }
    speakerWords.push(w.word)
  }

  if (speakerWords.length > 0) {
    transcript += `Speaker ${currentSpeaker}: ${speakerWords.join(' ')}`
  }

  return transcript
}

export async function callDeepgram(
  options: ProcessingOptions,
  finalPath: string
) {
  if (!env['DEEPGRAM_API_KEY']) {
    throw new Error('DEEPGRAM_API_KEY environment variable is not set. Please set it to your Deepgram API key.')
  }

  try {
    const defaultDeepgramModel = TRANSCRIPTION_SERVICES_CONFIG.deepgram.models.find(m => m.modelId === 'nova-2')?.modelId || 'nova-2'
    const deepgramModel = typeof options.deepgram === 'string'
      ? options.deepgram
      : defaultDeepgramModel

    const modelInfo =
      TRANSCRIPTION_SERVICES_CONFIG.deepgram.models.find(m => m.modelId.toLowerCase() === deepgramModel.toLowerCase())
      || TRANSCRIPTION_SERVICES_CONFIG.deepgram.models.find(m => m.modelId === 'nova-2')

    if (!modelInfo) {
      throw new Error(`Model information for model ${deepgramModel} is not defined.`)
    }

    const { modelId, costPerMinuteCents } = modelInfo

    const apiUrl = new URL('https://api.deepgram.com/v1/listen')
    apiUrl.searchParams.append('model', modelId)
    apiUrl.searchParams.append('smart_format', 'true')
    apiUrl.searchParams.append('punctuate', 'true')
    apiUrl.searchParams.append('diarize', options.speakerLabels ? 'true' : 'false')
    apiUrl.searchParams.append('paragraphs', 'true')

    const audioBuffer = await readFile(`${finalPath}.wav`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${env['DEEPGRAM_API_KEY']}`,
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer as unknown as BodyInit
    })

    if (!response.ok) {
      throw new Error(`Deepgram API request failed with status ${response.status}`)
    }

    const result = await response.json()

    const channel = result.results?.channels?.[0]
    const alternative = channel?.alternatives?.[0]

    if (!alternative?.words) {
      throw new Error('No transcription results found in Deepgram response')
    }

    const txtContent = formatDeepgramTranscript(alternative.words, options.speakerLabels || false)
    return {
      transcript: txtContent,
      modelId,
      costPerMinuteCents
    }
  } catch (error) {
    err(`Error processing transcription: ${(error as Error).message}`)
    throw error
  }
}