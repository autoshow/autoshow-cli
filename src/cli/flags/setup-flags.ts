import type { CliFlagsDefinition } from '~/cli/native'

export const setupFlags = {
  doctor: {
    description: 'Check prerequisites, API keys, and configuration without installing anything',
    type: Boolean,
    default: false,
    negatable: false
  },
  models: {
    description: 'Download one or more local Whisper or llama.cpp models without running inference (repeatable)',
    type: [String] as [StringConstructor]
  },
  step: {
    description: 'Run only a specific setup step: uv|yt-dlp|defuddle|whisper-binary|whisper-model|llama-binary|reverb|calibre|all|transcription|write|tts|image|video|music (default: all). Assumes prerequisites are already installed for isolated steps.',
    type: String,
    default: 'all'
  },
  'force-redownload': {
    description: 'Remove existing artifacts before downloading',
    type: Boolean,
    default: false,
    negatable: false
  },
  repeat: {
    description: 'Repeat the setup step N times for benchmarking (default: 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition
