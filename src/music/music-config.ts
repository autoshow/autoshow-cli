export const MUSIC_SERVICES_CONFIG = {
  elevenlabs: {
    serviceName: 'ElevenLabs Music',
    value: 'elevenlabs',
    apiKeyEnvVar: 'ELEVENLABS_API_KEY',
    defaultModel: 'music_v1',
    defaultFormat: 'mp3_44100_128',
    requiresLyrics: false,
    supportsCompositionPlan: true,
    supportsInstrumental: true,
  },
  minimax: {
    serviceName: 'MiniMax Music',
    value: 'minimax',
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    defaultModel: 'music-2.5',
    defaultFormat: 'mp3_44100_256000',
    requiresLyrics: true,
    supportsCompositionPlan: false,
    supportsInstrumental: false,
  },
} as const

export type MusicService = keyof typeof MUSIC_SERVICES_CONFIG

export const VALID_MUSIC_SERVICES = Object.keys(MUSIC_SERVICES_CONFIG) as MusicService[]

export function isValidMusicService(service: string): service is MusicService {
  return VALID_MUSIC_SERVICES.includes(service as MusicService)
}
