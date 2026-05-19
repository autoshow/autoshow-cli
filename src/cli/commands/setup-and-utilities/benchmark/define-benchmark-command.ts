import { defineCliCommand } from '~/cli/native'
import { runBenchmark } from './run-benchmark'
import type { BenchmarkFlags } from './benchmark-types'

export const benchmarkCommand = defineCliCommand({
  name: 'benchmark',
  description: 'Benchmark STT transcription quality or score an existing TTS run',
  parameters: [{ key: '[input]', description: 'Audio file path to benchmark, or TTS run directory with --tts' }],
  flags: {
    tts: {
      description: 'Score an existing TTS run directory and write voice-quality reports',
      type: Boolean,
      default: false
    },
    bitrates: {
      description: 'Comma-separated bitrate list in kbps',
      type: String,
      default: '128,96,64,48,32,24,16,8'
    },
    speeds: {
      description: 'Comma-separated speed multipliers',
      type: String,
      default: '1.25,1.5,2.0,2.5,3.0'
    },
    'stt-services': {
      description: 'Comma-separated STT services to test (default: all available)',
      type: String
    },
    'reference-stt': {
      description: 'Service:model for reference transcription (e.g., deepgram:nova-3)',
      type: String,
      default: 'deepgram:nova-3'
    },
    'skip-compression': {
      description: 'Skip compression spectrum tests',
      type: Boolean,
      default: false
    },
    'skip-speed': {
      description: 'Skip speed spectrum tests',
      type: Boolean,
      default: false
    },
    'output-dir': {
      description: 'Custom output directory for benchmark results',
      type: String
    },
    'tts-input-text': {
      description: 'Original TTS source text, or a text file path, for runs without metadata.input',
      type: String
    },
    'tts-mode': {
      description: 'TTS scoring mode: full may call paid STT/audio judge when credentials exist; local never does',
      type: String,
      default: 'full'
    },
    'tts-roundtrip-dir': {
      description: 'Directory of existing roundtrip transcripts for TTS scoring',
      type: String
    },
    'tts-metric-fixtures': {
      description: 'JSON fixtures with precomputed TTS quality metrics and transcripts',
      type: String
    },
    'tts-audio-judge-model': {
      description: 'OpenAI audio-capable chat model for paid TTS rubric judging',
      type: String,
      default: 'gpt-audio'
    },
    'tts-keep-temp': {
      description: 'Keep temporary normalized audio files created during TTS scoring',
      type: Boolean,
      default: false
    }
  },
  help: {
    examples: [
      ['bun as benchmark input/examples/audio/1-audio.mp3', 'Run full benchmark with all available STT services'],
      ['bun as benchmark audio.mp3 --stt-services whisper', 'Benchmark with local Whisper only'],
      ['bun as benchmark audio.mp3 --stt-services deepgram,groq --skip-speed', 'Compression-only benchmark with select services'],
      ['bun as benchmark audio.mp3 --bitrates 96,64,32,16 --speeds 1.5,2.0,3.0', 'Custom bitrate and speed ranges'],
      ['bun as benchmark docs/benchmarks/tts/<run> --tts', 'Score an existing TTS run with full scoring'],
      ['bun as benchmark docs/benchmarks/tts/<run> --tts --tts-mode local', 'Score a TTS run without paid calls'],
      ['bun as benchmark docs/benchmarks/tts/<run> --tts --tts-roundtrip-dir <dir>', 'Use existing roundtrip STT transcripts']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags as unknown as BenchmarkFlags
  await runBenchmark(ctx.parameters.input, flags)
})
