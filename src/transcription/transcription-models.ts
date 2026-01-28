export const TRANSCRIPTION_SERVICES_CONFIG = {
  whisper: {
    serviceName: 'Whisper.cpp',
    value: 'whisper',
    label: 'Whisper.cpp',
    models: [
      { modelId: 'tiny', costPerMinuteCents: 0 },
      { modelId: 'tiny.en', costPerMinuteCents: 0 },
      { modelId: 'base', costPerMinuteCents: 0 },
      { modelId: 'base.en', costPerMinuteCents: 0 },
      { modelId: 'small', costPerMinuteCents: 0 },
      { modelId: 'small.en', costPerMinuteCents: 0 },
      { modelId: 'medium', costPerMinuteCents: 0 },
      { modelId: 'medium.en', costPerMinuteCents: 0 },
      { modelId: 'large-v1', costPerMinuteCents: 0 },
      { modelId: 'large-v2', costPerMinuteCents: 0 },
      { modelId: 'large-v3-turbo', costPerMinuteCents: 0 },
      { modelId: 'turbo', costPerMinuteCents: 0 },
    ]
  },
  whisperCoreml: {
    serviceName: 'Whisper.cpp CoreML',
    value: 'whisperCoreml',
    label: 'Whisper CoreML',
    models: [
      { modelId: 'tiny', costPerMinuteCents: 0 },
      { modelId: 'tiny.en', costPerMinuteCents: 0 },
      { modelId: 'base', costPerMinuteCents: 0 },
      { modelId: 'base.en', costPerMinuteCents: 0 },
      { modelId: 'small', costPerMinuteCents: 0 },
      { modelId: 'small.en', costPerMinuteCents: 0 },
      { modelId: 'medium', costPerMinuteCents: 0 },
      { modelId: 'medium.en', costPerMinuteCents: 0 },
      { modelId: 'large-v1', costPerMinuteCents: 0 },
      { modelId: 'large-v2', costPerMinuteCents: 0 },
      { modelId: 'large-v3-turbo', costPerMinuteCents: 0 },
      { modelId: 'turbo', costPerMinuteCents: 0 },
    ]
  },
  deepgram: {
    serviceName: 'Deepgram',
    value: 'deepgram',
    label: 'Deepgram',
    models: [
      { modelId: 'nova-3', costPerMinuteCents: 0.43 },
      { modelId: 'nova-2', costPerMinuteCents: 0.43 },
    ]
  },
  assembly: {
    serviceName: 'AssemblyAI',
    value: 'assembly',
    label: 'AssemblyAI',
    models: [
      { modelId: 'universal', costPerMinuteCents: 0.62 },
      { modelId: 'slam-1', costPerMinuteCents: 0.62 },
      { modelId: 'nano', costPerMinuteCents: 0.2 },
    ]
  },
  groqWhisper: {
    serviceName: 'Groq Whisper',
    value: 'groqWhisper',
    label: 'Groq Whisper',
    models: [
      { modelId: 'whisper-large-v3-turbo', costPerMinuteCents: 0.0667 },
      { modelId: 'distil-whisper-large-v3-en', costPerMinuteCents: 0.0333 },
      { modelId: 'whisper-large-v3', costPerMinuteCents: 0.185 },
    ]
  },
  reverb: {
    serviceName: 'Reverb ASR + Diarization',
    value: 'reverb',
    label: 'Reverb',
    models: [
      { modelId: 'reverb_asr_v1', costPerMinuteCents: 0 },
    ],
    diarizationModels: [
      { modelId: 'reverb-diarization-v1' },
      { modelId: 'reverb-diarization-v2' },
    ]
  },
} as const
