export const TTS_PROVIDERS = ['kitten', 'elevenlabs', 'minimax', 'groq', 'grok', 'openai', 'gemini', 'deepgram', 'runway', 'deapi'] as const
export type TtsProvider = typeof TTS_PROVIDERS[number]

export const IMAGE_PROVIDERS = ['gemini', 'openai', 'minimax', 'glm', 'grok', 'runway', 'bfl', 'deapi'] as const
export type ImageProvider = typeof IMAGE_PROVIDERS[number]

export const VIDEO_PROVIDERS = ['gemini', 'minimax', 'glm', 'grok', 'runway', 'deapi'] as const
export type VideoProvider = typeof VIDEO_PROVIDERS[number]

export const MUSIC_PROVIDERS = ['elevenlabs', 'minimax', 'deapi', 'gemini'] as const
export type MusicProvider = typeof MUSIC_PROVIDERS[number]

export const OCR_PROVIDERS = ['tesseract', 'ocrmypdf', 'paddle-ocr', 'mistral', 'glm', 'kimi', 'openai', 'anthropic', 'gemini', 'deepinfra', 'aws-textract', 'gcloud-docai', 'deapi'] as const
export type OcrProvider = typeof OCR_PROVIDERS[number]
