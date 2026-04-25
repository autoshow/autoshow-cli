export const TTS_PROVIDERS = ['kitten', 'elevenlabs', 'minimax', 'groq', 'openai', 'gemini', 'deepgram'] as const
export type TtsProvider = typeof TTS_PROVIDERS[number]

export const IMAGE_PROVIDERS = ['gemini', 'openai', 'minimax', 'glm', 'grok', 'runway'] as const
export type ImageProvider = typeof IMAGE_PROVIDERS[number]

export const VIDEO_PROVIDERS = ['gemini', 'minimax'] as const
export type VideoProvider = typeof VIDEO_PROVIDERS[number]

export const MUSIC_PROVIDERS = ['elevenlabs', 'minimax'] as const
export type MusicProvider = typeof MUSIC_PROVIDERS[number]
