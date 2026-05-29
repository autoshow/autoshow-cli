import { readConfiguredEnvVar } from '../../../../../test-utils/test-helpers'
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_TTS_VOICE,
  OPENAI_DEFAULT_TTS_VOICE,
  DEEPGRAM_DEFAULT_VOICE,
  GROK_DEFAULT_TTS_VOICE,
  SPEECHIFY_DEFAULT_TTS_VOICE,
} from '~/cli/commands/setup-and-utilities/models/model-options'

export const mistralTtsModel = 'voxtral-mini-tts-2603'
export const mistralRefAudioPath = 'input/examples/audio/anthony-voice.mp3'
const shortTtsInputPath = 'input/examples/tts/0-tts-short.txt'
const shortTtsInputTitle = '0-tts-short'

export const openaiTts = {
  provider: 'openai',
  ttsService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('OPENAI_TTS_VOICE')
    return voice ?? OPENAI_DEFAULT_TTS_VOICE
  },
} as const

export const geminiTts = {
  provider: 'gemini',
  ttsService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('GEMINI_TTS_VOICE')
    return voice ?? GEMINI_DEFAULT_TTS_VOICE
  },
} as const

export const minimaxTts = {
  provider: 'minimax',
  ttsService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax TTS',
  extraArgs: ['--tts-voice', 'English_expressive_narrator'],
  resolveExpectedSpeaker: async () => 'English_expressive_narrator',
} as const

export const elevenlabsTts = {
  provider: 'elevenlabs',
  ttsService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs TTS',
  resolveExpectedSpeaker: async () => {
    const voiceId = await readConfiguredEnvVar('ELEVENLABS_VOICE_ID')
    return voiceId ?? ELEVENLABS_DEFAULT_VOICE_ID
  },
} as const

export const groqTts = {
  provider: 'groq',
  ttsService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq TTS',
  extraArgs: ['--groq-voice', 'troy'],
  resolveExpectedSpeaker: async () => 'troy',
} as const

export const grokTts = {
  provider: 'grok',
  ttsService: 'grok',
  envVarKey: 'XAI_API_KEY',
  envVarDescription: 'xAI Grok TTS',
  extraArgs: ['--tts-voice', GROK_DEFAULT_TTS_VOICE],
  resolveExpectedSpeaker: async () => GROK_DEFAULT_TTS_VOICE,
} as const

export const deepgramTts = {
  provider: 'deepgram',
  ttsService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram TTS',
  inputPath: shortTtsInputPath,
  inputTitle: shortTtsInputTitle,
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('DEEPGRAM_TTS_VOICE')
    return voice ?? DEEPGRAM_DEFAULT_VOICE
  },
} as const

export const speechifyTts = {
  provider: 'speechify',
  ttsService: 'speechify',
  envVarKey: 'SPEECHIFY_API_KEY',
  envVarDescription: 'Speechify TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('SPEECHIFY_TTS_VOICE')
    return voice ?? SPEECHIFY_DEFAULT_TTS_VOICE
  },
} as const

export const humeTts = {
  provider: 'hume',
  ttsService: 'hume',
  envVarKey: 'HUME_API_KEY',
  envVarDescription: 'Hume TTS',
} as const

export const cartesiaTts = {
  provider: 'cartesia',
  ttsService: 'cartesia',
  envVarKey: 'CARTESIA_API_KEY',
  envVarDescription: 'Cartesia TTS',
} as const

export const isTransientMistralTtsFailure = (output: string): boolean =>
  /Unable to connect|Unexpected HTTP client error|fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(output)
